import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { isEmail } from 'class-validator';
import { createHash, randomUUID } from 'node:crypto';
import { Types, type ClientSession, type Model } from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AlertsService } from '../alerts/alerts.service';
import { AuditsService } from '../audits/audits.service';
import { BudgetLedgerService } from '../budgets/budget-ledger.service';
import { EventBudget } from '../budgets/schemas/event-budget.schema';
import { Event } from '../events/schemas/event.schema';
import { MailService } from '../mail/mail.service';
import { providerServiceRequestEmail } from '../mail/templates/provider-service-request.email';
import { Provider } from '../providers/schemas/provider.schema';
import { Tenant } from '../tenants/schemas/tenant.schema';
import { CreateProviderServiceDto } from './dto/create-provider-service.dto';
import {
  deriveProviderConfirmationToken,
  digestProviderConfirmationToken,
  matchesProviderConfirmationToken,
} from './provider-confirmation-token';
import {
  EventProviderService,
  type EventProviderServiceDocument,
} from './schemas/event-provider-service.schema';
import { ProviderServiceMail } from './schemas/provider-service-mail.schema';
import type { ProviderServiceStatus } from './provider-services.constants';

const DAY = 24 * 60 * 60 * 1000;
const OPEN: ProviderServiceStatus[] = ['pendiente', 'aceptado_sin_saldo'];

@Injectable()
export class ProviderServiceWorkflow implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProviderServiceWorkflow.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(
    @InjectModel(EventProviderService.name)
    private readonly services: Model<EventProviderService>,
    @InjectModel(ProviderServiceMail.name)
    private readonly jobs: Model<ProviderServiceMail>,
    @InjectModel(Event.name) private readonly events: Model<Event>,
    @InjectModel(Provider.name) private readonly providers: Model<Provider>,
    @InjectModel(EventBudget.name) private readonly budgets: Model<EventBudget>,
    @InjectModel(Tenant.name) private readonly tenants: Model<Tenant>,
    private readonly ledger: BudgetLedgerService,
    private readonly alerts: AlertsService,
    private readonly audits: AuditsService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await Promise.all([
      this.jobs.createIndexes(),
      this.services.createIndexes(),
    ]);
    if (this.config.get<string>('PROVIDER_WORKER_ENABLED') === 'false') return;
    this.timer = setInterval(() => {
      void this.tick().catch((error: unknown) =>
        this.logger.error('Falló el procesamiento de servicios.', error),
      );
    }, 15000);
    this.timer.unref();
    void this.tick().catch((error: unknown) =>
      this.logger.error('Falló la recuperación de servicios.', error),
    );
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private settings() {
    const secret =
      this.config.get<string>('PROVIDER_CONFIRMATION_SECRET') ?? '';
    const base = this.config.get<string>('API_PUBLIC_URL') ?? '';
    let url: URL;
    try {
      url = new URL(base);
    } catch {
      throw new ServiceUnavailableException(
        'Configura API_PUBLIC_URL para las confirmaciones de proveedores.',
      );
    }
    if (
      secret.length < 32 ||
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== 'https:' &&
        !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    )
      throw new ServiceUnavailableException(
        'Configura una URL pública segura y PROVIDER_CONFIRMATION_SECRET de al menos 32 caracteres.',
      );
    return { secret, base: base.replace(/\/$/, '') };
  }

  private async transaction<T>(
    fn: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.services.db.startSession();
    try {
      return await session.withTransaction(() => fn(session), {
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
      });
    } finally {
      await session.endSession();
    }
  }

  private async event(
    tenantId: string,
    eventId: string,
    session: ClientSession,
  ) {
    const activeCompany = await this.tenants.collection.updateOne(
      { _id: new Types.ObjectId(tenantId), status: 'activo' },
      { $inc: { serviceDecisionRevision: 1 } },
      { session },
    );
    if (!activeCompany.matchedCount)
      throw new ConflictException('La empresa no está disponible.');
    const event = await this.events.findOneAndUpdate(
      { _id: eventId, tenantId },
      { $inc: { budgetDecisionRevision: 1 } },
      { session, returnDocument: 'after' },
    );
    if (!event) throw new NotFoundException('El evento no existe.');
    return event;
  }

  private async provider(
    tenantId: string,
    providerId: string,
    session: ClientSession,
  ) {
    // A write on the provider also conflicts with concurrent deactivation/contact changes.
    await this.providers.collection.updateOne(
      {
        _id: new Types.ObjectId(providerId),
        tenantId: new Types.ObjectId(tenantId),
      },
      { $inc: { serviceDecisionRevision: 1 } },
      { session },
    );
    const provider = await this.providers
      .findOne({ _id: providerId, tenantId })
      .session(session);
    if (!provider) throw new NotFoundException('El proveedor no existe.');
    return provider;
  }

  async request(
    eventId: string,
    dto: CreateProviderServiceDto,
    user: AuthenticatedUser,
  ) {
    const { secret } = this.settings();
    const id = new Types.ObjectId();
    const token = deriveProviderConfirmationToken(secret, id.toString(), 1);
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify([
          eventId,
          dto.providerId,
          dto.serviceName.trim(),
          dto.description?.trim() || null,
          dto.startDate,
          dto.startTime ?? null,
          dto.endDate ?? null,
          dto.endTime ?? null,
          dto.agreedAmountCop,
        ]),
      )
      .digest('hex');
    const replay = async (session?: ClientSession) => {
      if (!dto.idempotencyKey) return null;
      const existing = await this.services
        .findOne({
          tenantId: user.tenantId,
          assignedBy: user.id,
          idempotencyKey: dto.idempotencyKey,
        })
        .select('+requestFingerprint')
        .session(session ?? null);
      if (existing && existing.requestFingerprint !== fingerprint)
        throw new ConflictException(
          'La clave de idempotencia ya se utilizó con otros datos.',
        );
      return existing;
    };
    try {
      return await this.transaction(async (session) => {
        const existing = await replay(session);
        if (existing) return existing;
        const tenantId = user.tenantId!;
        const event = await this.event(tenantId, eventId, session);
        if (event.status === 'cancelado')
          throw new ConflictException(
            'No puedes solicitar servicios para un evento cancelado.',
          );
        const provider = await this.provider(tenantId, dto.providerId, session);
        if (provider.status !== 'activo')
          throw new ConflictException('El proveedor está inactivo.');
        if (!provider.email || !isEmail(provider.email))
          throw new BadRequestException(
            'El proveedor debe tener un correo válido para confirmar el servicio.',
          );
        const now = new Date();
        const [service] = await this.services.create(
          [
            {
              ...dto,
              requestFingerprint: fingerprint,
              _id: id,
              tenantId,
              eventId,
              serviceName: dto.serviceName.trim(),
              description: dto.description?.trim() || null,
              assignedBy: user.id,
              status: 'pendiente',
              providerEmail: provider.email,
              confirmationVersion: 1,
              confirmationDigest: digestProviderConfirmationToken(token),
              responseExpiresAt: new Date(now.getTime() + DAY),
              nextCheckAt: now,
            },
          ],
          { session },
        );
        await this.queue(service, 'request', session);
        await this.changed(service, session);
        await this.audits.record(
          {
            tenantId,
            actor: user,
            module: 'servicios_proveedor',
            action: 'solicitar',
            entity: 'servicio_proveedor',
            entityId: id,
            description: 'Solicitó confirmación de un servicio al proveedor.',
          },
          session,
        );
        return service;
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        const existing = await replay();
        if (existing) return existing;
      }
      throw error;
    }
  }

  private async queue(
    service: EventProviderServiceDocument,
    kind: 'request' | 'cancel',
    session: ClientSession,
  ) {
    if (!service.providerEmail) return; // Legacy services may only have a telephone.
    await this.jobs.updateOne(
      {
        tenantId: service.tenantId,
        serviceId: service._id,
        version: service.confirmationVersion,
        kind,
      },
      {
        $setOnInsert: {
          recipient: service.providerEmail,
          nextAttemptAt: new Date(),
        },
      },
      { upsert: true, session },
    );
  }

  private async changed(
    service: EventProviderServiceDocument,
    session: ClientSession,
  ) {
    service.notificationRevision = (service.notificationRevision ?? 0) + 1;
    await service.save({ session });
    await this.alerts.providerServiceChanged(
      {
        tenantId: service.tenantId.toString(),
        recipientId: service.assignedBy.toString(),
        eventId: service.eventId.toString(),
        serviceId: service._id.toString(),
        status: service.status,
        revision: service.notificationRevision,
      },
      session,
    );
  }

  private async finish(
    service: EventProviderServiceDocument,
    status: 'cancelado' | 'vencido' | 'rechazado',
    reason: string,
    session: ClientSession,
  ) {
    if (
      service.status === 'confirmado' &&
      (await this.ledger.hasBudget(
        service.tenantId.toString(),
        service.eventId.toString(),
        session,
      ))
    ) {
      await this.ledger.releaseProviderCost(
        service.tenantId.toString(),
        service.eventId.toString(),
        service.agreedAmountCop,
        session,
      );
      await this.alerts.checkBudget(
        service.tenantId.toString(),
        service.eventId.toString(),
        session,
      );
    }
    service.status = status;
    service.cancelledAt = new Date();
    service.cancellationReason = reason;
    service.nextCheckAt = null;
    await service.save({ session });
    if (status !== 'rechazado') await this.queue(service, 'cancel', session);
    await this.changed(service, session);
  }

  private authorize(
    service: EventProviderServiceDocument,
    event: Event,
    user: AuthenticatedUser,
  ) {
    if (
      service.assignedBy.toString() !== user.id &&
      event.responsibleUserId?.toString() !== user.id
    )
      throw new ForbiddenException(
        'Solo el solicitante o el responsable actual del evento pueden realizar esta acción.',
      );
  }

  async cancel(eventId: string, id: string, user: AuthenticatedUser) {
    return this.transaction(async (session) => {
      const event = await this.event(user.tenantId!, eventId, session);
      const service = await this.services
        .findOne({ _id: id, eventId, tenantId: user.tenantId })
        .session(session);
      if (!service)
        throw new NotFoundException('El servicio no existe en este evento.');
      this.authorize(service, event, user);
      if (service.status === 'cancelado') return service;
      if (
        !['pendiente', 'aceptado_sin_saldo', 'confirmado'].includes(
          service.status,
        )
      )
        throw new ConflictException('La solicitud ya finalizó.');
      if (!service.providerEmail) {
        const provider = await this.providers
          .findOne({ _id: service.providerId, tenantId: service.tenantId })
          .session(session);
        service.providerEmail = provider?.email ?? null;
      }
      await this.finish(service, 'cancelado', 'cancelado_por_usuario', session);
      await this.audits.record(
        {
          tenantId: user.tenantId!,
          actor: user,
          module: 'servicios_proveedor',
          action: 'cancelar',
          entity: 'servicio_proveedor',
          entityId: id,
          description: 'Canceló el servicio de proveedor.',
        },
        session,
      );
      return service;
    });
  }

  async resend(eventId: string, id: string, user: AuthenticatedUser) {
    const { secret } = this.settings();
    return this.transaction(async (session) => {
      const event = await this.event(user.tenantId!, eventId, session);
      const service = await this.services
        .findOne({ _id: id, eventId, tenantId: user.tenantId })
        .session(session);
      if (!service)
        throw new NotFoundException('El servicio no existe en este evento.');
      this.authorize(service, event, user);
      if (
        event.status === 'cancelado' ||
        service.status !== 'pendiente' ||
        !service.responseExpiresAt ||
        service.responseExpiresAt <= new Date()
      )
        throw new ConflictException(
          'La solicitud no admite reenvío; crea una nueva solicitud.',
        );
      if (Date.now() - (service.responseExpiresAt.getTime() - DAY) < 60000)
        throw new ConflictException('Espera un minuto antes de reenviar.');
      const provider = await this.provider(
        user.tenantId!,
        service.providerId.toString(),
        session,
      );
      if (
        provider.status !== 'activo' ||
        provider.email !== service.providerEmail
      )
        throw new ConflictException(
          'El proveedor o su correo cambiaron; crea una nueva solicitud.',
        );
      service.confirmationVersion += 1;
      service.confirmationDigest = digestProviderConfirmationToken(
        deriveProviderConfirmationToken(
          secret,
          id,
          service.confirmationVersion,
        ),
      );
      service.responseExpiresAt = new Date(Date.now() + DAY);
      service.emailDelivery = 'queued';
      service.emailSentAt = null;
      await service.save({ session });
      await this.queue(service, 'request', session);
      return service;
    });
  }

  private async authenticated(
    id: string,
    token: string,
    session?: ClientSession,
  ) {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Enlace inválido.');
    const service = await this.services
      .findById(id)
      .select('+confirmationDigest')
      .session(session ?? null);
    if (
      !service ||
      !service.confirmationDigest ||
      !matchesProviderConfirmationToken(token, service.confirmationDigest)
    )
      throw new NotFoundException('Enlace inválido.');
    return service;
  }

  async inspect(id: string, token: string) {
    const service = await this.authenticated(id, token);
    const event = await this.events
      .findOne({ _id: service.eventId, tenantId: service.tenantId })
      .lean();
    if (!event)
      throw new NotFoundException('La solicitud ya no está disponible.');
    const company = await this.tenants
      .findOne({ _id: service.tenantId, status: 'activo' })
      .lean();
    if (!company)
      throw new NotFoundException('La solicitud ya no está disponible.');
    const provider = await this.providers
      .findOne({
        _id: service.providerId,
        tenantId: service.tenantId,
        status: 'activo',
        email: service.providerEmail,
      })
      .lean();
    if (!provider)
      throw new NotFoundException('La solicitud ya no está disponible.');
    return {
      serviceId: id,
      eventName: event.name,
      serviceName: service.serviceName,
      description: service.description,
      startDate: service.startDate,
      startTime: service.startTime,
      endDate: service.endDate,
      endTime: service.endTime,
      agreedAmountCop: service.agreedAmountCop,
      status: service.status,
      responseExpiresAt: service.responseExpiresAt,
      fundingExpiresAt: service.fundingExpiresAt,
      canRespond:
        event.status !== 'cancelado' &&
        service.status === 'pendiente' &&
        !!service.responseExpiresAt &&
        service.responseExpiresAt > new Date(),
    };
  }

  async respond(
    id: string,
    token: string,
    decision: 'aceptar' | 'rechazar',
    reason?: string,
  ) {
    await this.transaction(async (session) => {
      const service = await this.authenticated(id, token, session);
      const event = await this.event(
        service.tenantId.toString(),
        service.eventId.toString(),
        session,
      );
      if (service.responseDecision) {
        if (service.responseDecision !== decision)
          throw new ConflictException('La solicitud ya tiene otra respuesta.');
        return; // Replayed/lost HTTP response never charges again.
      }
      if (
        service.status !== 'pendiente' ||
        !service.responseExpiresAt ||
        service.responseExpiresAt <= new Date()
      )
        throw new ConflictException('La solicitud ya finalizó o venció.');
      if (event.status === 'cancelado')
        throw new ConflictException('El evento fue cancelado.');
      const provider = await this.provider(
        service.tenantId.toString(),
        service.providerId.toString(),
        session,
      );
      if (
        provider.status !== 'activo' ||
        provider.email !== service.providerEmail
      )
        throw new ConflictException(
          'El proveedor o su correo ya no están disponibles.',
        );
      service.respondedAt = new Date();
      service.responseDecision = decision;
      if (decision === 'rechazar') {
        service.rejectionReason = reason?.trim() || null;
        await this.finish(
          service,
          'rechazado',
          'rechazado_por_proveedor',
          session,
        );
      } else {
        service.acceptedAt = new Date();
        service.fundingExpiresAt = new Date(service.acceptedAt.getTime() + DAY);
        service.status = 'aceptado_sin_saldo';
        await this.allocate(service, session);
      }
    });
    return this.inspect(id, token);
  }

  private async allocate(
    service: EventProviderServiceDocument,
    session: ClientSession,
    notifyPending = true,
  ) {
    if (!service.fundingExpiresAt || service.fundingExpiresAt <= new Date()) {
      await this.finish(service, 'cancelado', 'sin_saldo_en_24h', session);
      return;
    }
    const budget = await this.budgets.findOneAndUpdate(
      {
        tenantId: service.tenantId,
        eventId: service.eventId,
        $expr: this.ledger.hasAvailable(service.agreedAmountCop),
      },
      { $inc: { providerSpentCop: service.agreedAmountCop } },
      { session, returnDocument: 'after' },
    );
    if (budget) {
      service.status = 'confirmado';
      service.confirmedAt = new Date();
      service.nextCheckAt = null;
      await this.alerts.checkBudget(
        service.tenantId.toString(),
        service.eventId.toString(),
        session,
      );
    } else service.nextCheckAt = new Date(Date.now() + 15000);
    await service.save({ session });
    if (budget || notifyPending) await this.changed(service, session);
  }

  async reconcileOne(id: string) {
    await this.transaction(async (session) => {
      const service = await this.services.findById(id).session(session);
      if (!service || !OPEN.includes(service.status)) return;
      const event = await this.event(
        service.tenantId.toString(),
        service.eventId.toString(),
        session,
      );
      const provider = await this.provider(
        service.tenantId.toString(),
        service.providerId.toString(),
        session,
      );
      if (
        event.status === 'cancelado' ||
        provider.status !== 'activo' ||
        provider.email !== service.providerEmail
      ) {
        await this.finish(
          service,
          'cancelado',
          'evento_o_proveedor_no_disponible',
          session,
        );
        return;
      }
      const now = new Date();
      if (service.status === 'pendiente') {
        if (service.responseExpiresAt && service.responseExpiresAt <= now)
          await this.finish(
            service,
            'vencido',
            'sin_respuesta_en_24h',
            session,
          );
        else {
          service.nextCheckAt = new Date(now.getTime() + 15000);
          await service.save({ session });
        }
      } else if (!service.fundingExpiresAt || service.fundingExpiresAt <= now)
        await this.finish(service, 'cancelado', 'sin_saldo_en_24h', session);
      else await this.allocate(service, session, false);
    });
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.services
        .find({ status: { $in: OPEN }, nextCheckAt: { $lte: new Date() } })
        .sort({ nextCheckAt: 1, _id: 1 })
        .limit(100)
        .select('_id')
        .lean();
      for (const service of due) {
        try {
          await this.reconcileOne(service._id.toString());
        } catch {
          await this.services.updateOne(
            { _id: service._id, status: { $in: OPEN } },
            { $set: { nextCheckAt: new Date(Date.now() + 30000) } },
          );
          this.logger.error('Se reintentará la conciliación de un servicio.');
        }
      }
      await this.deliverMail();
    } finally {
      this.running = false;
    }
  }

  async deliverMail() {
    for (let count = 0; count < 25; count += 1) {
      const claimId = randomUUID();
      const now = new Date();
      const job = await this.jobs.findOneAndUpdate(
        {
          deliveredAt: null,
          nextAttemptAt: { $lte: now },
          $or: [{ claimedUntil: null }, { claimedUntil: { $lte: now } }],
        },
        { $set: { claimId, claimedUntil: new Date(now.getTime() + 60000) } },
        { sort: { nextAttemptAt: 1 }, returnDocument: 'after' },
      );
      if (!job) return;
      try {
        const service = await this.services
          .findOne({ _id: job.serviceId, tenantId: job.tenantId })
          .select('+confirmationDigest');
        if (
          service &&
          (job.kind === 'cancel' ||
            (service.status === 'pendiente' &&
              service.confirmationVersion === job.version &&
              service.responseExpiresAt &&
              service.responseExpiresAt > new Date()))
        ) {
          if (job.kind === 'request') {
            const { secret, base } = this.settings();
            const event = await this.events
              .findOne({ _id: service.eventId, tenantId: service.tenantId })
              .lean();
            const company = await this.tenants
              .findById(service.tenantId)
              .lean();
            const provider = await this.providers
              .findOne({
                _id: service.providerId,
                tenantId: service.tenantId,
                status: 'activo',
                email: job.recipient,
              })
              .lean();
            if (!company || company.status !== 'activo') {
              throw new Error(
                'La empresa no está disponible para enviar correos.',
              );
            } else if (!event || event.status === 'cancelado' || !provider) {
              await this.reconcileOne(service._id.toString());
            } else {
              const token = deriveProviderConfirmationToken(
                secret,
                service._id.toString(),
                job.version,
              );
              if (
                !matchesProviderConfirmationToken(
                  token,
                  service.confirmationDigest ?? '',
                )
              )
                throw new Error(
                  'El secreto cambió; se requiere un reenvío autorizado.',
                );
              const email = providerServiceRequestEmail({
                companyName: company?.name ?? 'Empresa de EVORIA',
                eventName: event.name,
                serviceName: service.serviceName,
                startDate: service.startDate,
                startTime: service.startTime,
                amountCop: service.agreedAmountCop,
                responseExpiresAt: service.responseExpiresAt!,
                description: service.description,
                endDate: service.endDate,
                endTime: service.endTime,
                responseUrl: `${base}/provider-service-confirmation#id=${service._id.toString()}&token=${token}`,
              });
              await this.mail.send(job.recipient, email.subject, email.text);
              await this.services.updateOne(
                { _id: service._id, confirmationVersion: job.version },
                { $set: { emailDelivery: 'sent', emailSentAt: new Date() } },
              );
            }
          } else
            await this.mail.send(
              job.recipient,
              'Servicio cancelado en EVORIA',
              `La solicitud del servicio ${service.serviceName} para el ${service.startDate} fue cancelada. Referencia: ${service._id.toString()}.`,
            );
        }
        await this.jobs.updateOne(
          { _id: job._id, claimId },
          { $set: { deliveredAt: new Date(), claimedUntil: null } },
        );
      } catch {
        await this.jobs.updateOne(
          { _id: job._id, claimId },
          {
            $inc: { attempts: 1 },
            $set: {
              claimedUntil: null,
              nextAttemptAt: new Date(
                Date.now() +
                  Math.min(3600000, 30000 * 2 ** Math.min(job.attempts, 7)),
              ),
            },
          },
        );
        if (job.kind === 'request')
          await this.services.updateOne(
            {
              _id: job.serviceId,
              confirmationVersion: job.version,
              status: 'pendiente',
            },
            { $set: { emailDelivery: 'failed' } },
          );
        this.logger.warn('Se reintentará un correo de servicio de proveedor.');
      }
    }
  }
}
