import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  isValidObjectId,
  type ClientSession,
  type Model,
  Types,
} from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AlertsService } from '../alerts/alerts.service';
import { AuditsService } from '../audits/audits.service';
import { Event } from '../events/schemas/event.schema';
import { InventoryItem } from '../inventory/schemas/inventory-item.schema';
import { EventProviderService } from '../provider-services/schemas/event-provider-service.schema';
import { Provider } from '../providers/schemas/provider.schema';
import { EventResource } from '../resources/schemas/event-resource.schema';
import { BudgetLedgerService } from './budget-ledger.service';
import { CreateBudgetRequestDto } from './dto/create-budget-request.dto';
import { FindBudgetsDto } from './dto/find-budgets.dto';
import {
  EventBudget,
  type EventBudgetRequest,
} from './schemas/event-budget.schema';

@Injectable()
export class BudgetsService {
  private readonly logger = new Logger(BudgetsService.name);
  constructor(
    @InjectModel(EventBudget.name)
    private readonly budgetModel: Model<EventBudget>,
    @InjectModel(Event.name) private readonly eventModel: Model<Event>,
    @InjectModel(EventResource.name)
    private readonly resourceModel: Model<EventResource>,
    @InjectModel(InventoryItem.name)
    private readonly inventoryModel: Model<InventoryItem>,
    @InjectModel(EventProviderService.name)
    private readonly providerServiceModel: Model<EventProviderService>,
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    private readonly ledger: BudgetLedgerService,
    private readonly auditsService: AuditsService,
    @Optional() private readonly alerts?: AlertsService,
  ) {}

  async overview(query: FindBudgetsDto, user: AuthenticatedUser) {
    const tenantId = this.getTenantId(user);
    const filter: {
      tenantId: string;
      status?: { $ne: 'cancelado' };
      name?: RegExp;
    } = { tenantId };
    if (!query.includeCancelled) filter.status = { $ne: 'cancelado' };
    if (query.search?.trim()) {
      filter.name = new RegExp(this.escapeRegExp(query.search.trim()), 'i');
    }
    const [events, total, activeEvents] = await Promise.all([
      this.eventModel
        .find(filter)
        .sort({ startAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean<Array<Event & { _id: Types.ObjectId }>>(),
      this.eventModel.countDocuments(filter),
      this.eventModel
        .find({ tenantId, status: { $ne: 'cancelado' } })
        .select('_id')
        .lean<Array<{ _id: Types.ObjectId }>>(),
    ]);
    const allIds = new Set([
      ...events.map((event) => event._id.toString()),
      ...activeEvents.map((event) => event._id.toString()),
    ]);
    const budgets = await this.budgetModel
      .find({ tenantId, eventId: { $in: [...allIds] } })
      .lean();
    const byEvent = new Map(
      budgets.map((budget) => [budget.eventId.toString(), budget]),
    );
    const totals = activeEvents.reduce(
      (result, event) => {
        const amounts = this.amounts(byEvent.get(event._id.toString()));
        result.allocatedCop += amounts.allocatedCop;
        result.spentCop += amounts.spentCop;
        result.remainingCop += amounts.remainingCop;
        return result;
      },
      { allocatedCop: 0, spentCop: 0, remainingCop: 0 },
    );
    return {
      totals,
      items: events.map((event) => ({
        eventId: event._id.toString(),
        eventName: event.name,
        eventStatus: event.status,
        initialized: byEvent.has(event._id.toString()),
        ...this.amounts(byEvent.get(event._id.toString())),
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async detail(eventId: string, user: AuthenticatedUser) {
    const tenantId = this.getTenantId(user);
    const event = await this.findEvent(eventId, tenantId);
    const budget = await this.budgetModel.findOne({ tenantId, eventId }).lean();
    const summary = {
      eventId,
      eventName: event.name,
      eventStatus: event.status,
      initialized: Boolean(budget),
      ...this.amounts(budget),
    };
    if (!budget) {
      return {
        ...summary,
        inventoryLines: [],
        providerLines: [],
        requests: [],
      };
    }

    const [assignments, services] = await Promise.all([
      this.resourceModel
        .find({ tenantId, eventId })
        .sort({ assignedAt: 1 })
        .lean(),
      this.providerServiceModel
        .find({ tenantId, eventId })
        .sort({ startDate: 1, _id: 1 })
        .lean(),
    ]);
    const [items, providers] = await Promise.all([
      this.inventoryModel
        .find({
          tenantId,
          _id: { $in: assignments.map((item) => item.inventoryItemId) },
        })
        .select('_id name')
        .lean(),
      this.providerModel
        .find({
          tenantId,
          _id: { $in: services.map((item) => item.providerId) },
        })
        .select('_id name')
        .lean(),
    ]);
    const inventoryNames = new Map(
      items.map((item) => [item._id.toString(), item.name]),
    );
    const providerNames = new Map(
      providers.map((item) => [item._id.toString(), item.name]),
    );
    return {
      ...summary,
      inventoryLines: assignments.map((assignment) => ({
        id: assignment._id.toString(),
        inventoryItemId: assignment.inventoryItemId.toString(),
        name:
          inventoryNames.get(assignment.inventoryItemId.toString()) ??
          'Recurso eliminado',
        quantity: assignment.quantity,
        costAmountCop: assignment.costAmountCop ?? 0,
        status: assignment.status,
        assignedAt: assignment.assignedAt,
      })),
      providerLines: services.map((service) => ({
        id: service._id.toString(),
        providerId: service.providerId.toString(),
        providerName:
          providerNames.get(service.providerId.toString()) ??
          'Proveedor eliminado',
        serviceName: service.serviceName,
        agreedAmountCop: service.agreedAmountCop,
        status: service.status,
        startDate: service.startDate,
      })),
      requests: budget.requests.map((request) =>
        this.toRequest(eventId, request),
      ),
    };
  }

  async initialize(
    eventId: string,
    baseAmountCop: number,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.getTenantId(user);
    const budget = await this.initializeForEvent(
      eventId,
      tenantId,
      baseAmountCop,
      user.id,
    );
    await this.auditsService.record({
      tenantId,
      actor: user,
      module: 'presupuestos',
      action: 'inicializar',
      entity: 'presupuesto',
      entityId: eventId,
      description: 'Inicializó el presupuesto del evento.',
    });
    return budget;
  }

  async initializeForEvent(
    eventId: string,
    tenantId: string,
    baseAmountCop: number,
    createdBy: string,
  ) {
    if (!Number.isSafeInteger(baseAmountCop) || baseAmountCop < 0) {
      throw new BadRequestException(
        'El presupuesto inicial debe ser un entero de COP no negativo.',
      );
    }
    const event = await this.findEvent(eventId, tenantId);
    if (event.status === 'cancelado') {
      throw new ConflictException(
        'No puedes iniciar el presupuesto de un evento cancelado.',
      );
    }
    if (await this.budgetModel.exists({ tenantId, eventId })) {
      throw new ConflictException('El evento ya tiene presupuesto inicial.');
    }
    const assignments = await this.resourceModel
      .find({ tenantId, eventId })
      .lean();
    const items = await this.inventoryModel
      .find({
        tenantId,
        _id: { $in: assignments.map((item) => item.inventoryItemId) },
      })
      .lean();
    const itemById = new Map(items.map((item) => [item._id.toString(), item]));
    let inventorySpentCop = 0;
    const missingSnapshots: Array<{ id: Types.ObjectId; amountCop: number }> =
      [];
    for (const assignment of assignments) {
      let amount = assignment.costAmountCop;
      if (amount === undefined || amount === null) {
        const item = itemById.get(assignment.inventoryItemId.toString());
        if (!item) {
          throw new ConflictException(
            'Falta un recurso de inventario para reconstruir el presupuesto.',
          );
        }
        amount = Math.round(item.unitCost * assignment.quantity);
        missingSnapshots.push({ id: assignment._id, amountCop: amount });
      }
      if (assignment.status === 'asignado') {
        inventorySpentCop += amount;
      }
    }
    const services = await this.providerServiceModel
      .find({ tenantId, eventId, status: 'confirmado' })
      .select('agreedAmountCop')
      .lean();
    const providerSpentCop = services.reduce(
      (sum, service) => sum + service.agreedAmountCop,
      0,
    );
    if (baseAmountCop < inventorySpentCop + providerSpentCop) {
      throw new ConflictException(
        'El presupuesto inicial no cubre los costos ya registrados.',
      );
    }
    for (const snapshot of missingSnapshots) {
      await this.resourceModel.updateOne(
        {
          _id: snapshot.id,
          tenantId,
          eventId,
          costAmountCop: { $exists: false },
        },
        { $set: { costAmountCop: snapshot.amountCop } },
      );
    }
    const session = await this.budgetModel.db.startSession();
    try {
      const budget = await session.withTransaction(async () => {
        const [created] = await this.budgetModel.create(
          [
            {
              tenantId,
              eventId,
              baseAmountCop,
              approvedIncreaseCop: 0,
              inventorySpentCop,
              providerSpentCop,
              extraSpentCop: 0,
              requests: [],
              createdBy,
            },
          ],
          { session },
        );
        if (event.baseBudget !== baseAmountCop) {
          await this.eventModel.updateOne(
            { _id: eventId, tenantId },
            { $set: { baseBudget: baseAmountCop } },
            { session },
          );
        }
        await this.alerts?.checkBudget(tenantId, eventId, session);
        return created;
      });
      return {
        eventId,
        initialized: true,
        ...this.amounts(budget),
      };
    } catch (error) {
      if (this.isDuplicateKey(error)) {
        throw new ConflictException('El evento ya tiene presupuesto inicial.');
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async submitRequest(
    eventId: string,
    dto: CreateBudgetRequestDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.getTenantId(user);
    const event = await this.findEvent(eventId, tenantId);
    if (event.status === 'cancelado') {
      throw new ConflictException(
        'El evento cancelado no admite solicitudes nuevas.',
      );
    }
    if (!event.responsibleUserId) {
      throw new ConflictException(
        'Asigna un líder al evento antes de solicitar cambios de presupuesto.',
      );
    }
    if (event.responsibleUserId.toString() === user.id) {
      throw new ForbiddenException(
        'El líder no puede solicitar y aprobar su propio cambio.',
      );
    }
    const reason = dto.reason.trim();
    if (reason.length < 10) {
      throw new BadRequestException(
        'El motivo debe tener al menos diez caracteres.',
      );
    }
    const requestId = new Types.ObjectId();
    const result = await this.budgetModel.findOneAndUpdate(
      { tenantId, eventId },
      {
        $push: {
          requests: {
            _id: requestId,
            type: dto.type,
            amountCop: dto.amountCop,
            reason,
            status: 'pendiente',
            requestedBy: user.id,
            requestedAt: new Date(),
            decidedBy: null,
            decidedAt: null,
            rejectionReason: null,
          },
        },
      },
      { new: true, runValidators: true },
    );
    if (!result) {
      throw new ConflictException(
        'El evento aún no tiene presupuesto inicial.',
      );
    }
    const created = result.requests.find(
      (request) => request._id.toString() === requestId.toString(),
    );
    if (!created)
      throw new ConflictException('No se pudo registrar la solicitud.');
    if (event.responsibleUserId) {
      await this.notify({
        tenantId,
        recipientId: event.responsibleUserId.toString(),
        type: 'budget_pending',
        title: 'Solicitud pendiente',
        message: 'Hay una solicitud de presupuesto pendiente de tu decisión.',
        eventId,
        requestId: requestId.toString(),
        dedupeKey: `pending:${requestId.toString()}:${event.responsibleUserId.toString()}`,
        permissions: [
          'eventos.ver',
          'presupuestos.ver',
          'presupuestos.aprobar',
        ],
      });
    }
    await this.auditsService.record({
      tenantId,
      actor: user,
      module: 'presupuestos',
      action: 'solicitar',
      entity: 'solicitud_presupuesto',
      entityId: created._id,
      description: 'Solicitó un cambio de presupuesto para el evento.',
    });
    return this.toRequest(eventId, created);
  }

  async authorizations(user: AuthenticatedUser) {
    const tenantId = this.getTenantId(user);
    const events = await this.eventModel
      .find({
        tenantId,
        responsibleUserId: user.id,
        status: { $ne: 'cancelado' },
      })
      .select('_id name')
      .lean();
    const budgets = await this.budgetModel
      .find({
        tenantId,
        eventId: { $in: events.map((event) => event._id) },
        'requests.status': 'pendiente',
      })
      .lean();
    const eventNames = new Map(
      events.map((event) => [event._id.toString(), event.name]),
    );
    return budgets.flatMap((budget) =>
      budget.requests
        .filter(
          (request) =>
            request.status === 'pendiente' &&
            request.requestedBy.toString() !== user.id,
        )
        .map((request) => ({
          eventName: eventNames.get(budget.eventId.toString()) ?? 'Evento',
          ...this.toRequest(budget.eventId.toString(), request),
        })),
    );
  }

  async notifyPendingForResponsible(
    tenantId: string,
    eventId: string,
    responsibleId: string,
  ) {
    if (!this.alerts) return;
    const budget = await this.budgetModel.findOne({ tenantId, eventId }).lean();
    if (!budget) return;
    for (const request of budget.requests) {
      if (
        request.status !== 'pendiente' ||
        request.requestedBy.toString() === responsibleId
      )
        continue;
      const requestId = request._id.toString();
      await this.notify({
        tenantId,
        recipientId: responsibleId,
        type: 'budget_pending',
        title: 'Solicitud pendiente',
        message: 'Hay una solicitud de presupuesto pendiente de tu decisión.',
        eventId,
        requestId,
        dedupeKey: `pending:${requestId}:${responsibleId}`,
        permissions: [
          'eventos.ver',
          'presupuestos.ver',
          'presupuestos.aprobar',
        ],
      });
    }
  }

  async notifyCancelledRequests(
    tenantId: string,
    eventId: string,
    responsibleId: string | null,
  ) {
    if (!this.alerts) return;
    const budget = await this.budgetModel.findOne({ tenantId, eventId }).lean();
    if (!budget) return;
    for (const request of budget.requests) {
      if (request.status !== 'pendiente') continue;
      const requestId = request._id.toString();
      const recipients = new Set([
        request.requestedBy.toString(),
        ...(responsibleId ? [responsibleId] : []),
      ]);
      for (const recipientId of recipients) {
        await this.notify({
          tenantId,
          recipientId,
          type: 'event_cancelled',
          title: 'Evento cancelado',
          message:
            'El evento fue cancelado y su solicitud pendiente no puede aprobarse.',
          eventId,
          requestId,
          dedupeKey: `cancelled:${requestId}:${recipientId}`,
          permissions: ['eventos.ver', 'presupuestos.ver'],
        });
      }
    }
  }

  async approve(eventId: string, requestId: string, user: AuthenticatedUser) {
    const decided = await this.withDecisionTransaction(
      eventId,
      user,
      (session) => this.approveLocked(eventId, requestId, user, session),
    );
    const tenantId = this.getTenantId(user);
    await this.notify({
      tenantId,
      recipientId: decided.requestedBy.toString(),
      type: 'budget_decided',
      title: 'Solicitud aprobada',
      message: 'Tu solicitud de presupuesto fue aprobada.',
      eventId,
      requestId,
      dedupeKey: `decision:${requestId}`,
      permissions: ['eventos.ver', 'presupuestos.ver'],
    });
    await this.alerts?.refreshThresholds(tenantId, eventId);
    return this.toRequest(eventId, decided);
  }

  private async approveLocked(
    eventId: string,
    requestId: string,
    user: AuthenticatedUser,
    session: ClientSession,
  ) {
    const { tenantId, request } = await this.findDecidableRequest(
      eventId,
      requestId,
      user,
      session,
    );
    const now = new Date();
    const filter: Record<string, unknown> = {
      tenantId,
      eventId,
      requests: { $elemMatch: { _id: requestId, status: 'pendiente' } },
    };
    if (request.type === 'costo_adicional') {
      filter.$expr = this.ledger.hasAvailable(request.amountCop);
    }
    const budget = await this.budgetModel.findOneAndUpdate(
      filter,
      {
        $set: {
          'requests.$.status': 'aprobada',
          'requests.$.decidedBy': user.id,
          'requests.$.decidedAt': now,
        },
        $inc:
          request.type === 'ampliacion'
            ? { approvedIncreaseCop: request.amountCop }
            : { extraSpentCop: request.amountCop },
      },
      { new: true, session },
    );
    if (!budget) {
      throw new ConflictException(
        request.type === 'costo_adicional'
          ? 'La solicitud ya fue decidida o no hay saldo suficiente para aprobarla.'
          : 'La solicitud ya fue decidida.',
      );
    }
    const decided = budget.requests.find(
      (item) => item._id.toString() === requestId,
    );
    if (!decided)
      throw new ConflictException('No se pudo consultar la decisión.');
    await this.alerts?.enqueue(
      {
        tenantId,
        recipientId: decided.requestedBy.toString(),
        type: 'budget_decided',
        title: 'Solicitud aprobada',
        message: 'Tu solicitud de presupuesto fue aprobada.',
        severity: 'info',
        eventId,
        requestId,
        dedupeKey: `decision:${requestId}`,
        permissions: ['eventos.ver', 'presupuestos.ver'],
      },
      session,
    );
    await this.alerts?.checkBudget(tenantId, eventId, session);
    await this.auditsService.record(
      {
        tenantId,
        actor: user,
        module: 'presupuestos',
        action: 'aprobar',
        entity: 'solicitud_presupuesto',
        entityId: decided._id,
        description: 'Aprobó una solicitud de cambio de presupuesto.',
      },
      session,
    );
    return decided;
  }

  async reject(
    eventId: string,
    requestId: string,
    reason: string,
    user: AuthenticatedUser,
  ) {
    const decided = await this.withDecisionTransaction(
      eventId,
      user,
      (session) => this.rejectLocked(eventId, requestId, reason, user, session),
    );
    const tenantId = this.getTenantId(user);
    await this.notify({
      tenantId,
      recipientId: decided.requestedBy.toString(),
      type: 'budget_decided',
      title: 'Solicitud rechazada',
      message:
        'Tu solicitud fue rechazada; consulta el motivo en el presupuesto.',
      eventId,
      requestId,
      dedupeKey: `decision:${requestId}`,
      permissions: ['eventos.ver', 'presupuestos.ver'],
    });
    return this.toRequest(eventId, decided);
  }

  private async rejectLocked(
    eventId: string,
    requestId: string,
    reason: string,
    user: AuthenticatedUser,
    session: ClientSession,
  ) {
    const { tenantId } = await this.findDecidableRequest(
      eventId,
      requestId,
      user,
      session,
    );
    const rejectionReason = reason.trim();
    if (rejectionReason.length < 10) {
      throw new BadRequestException(
        'El motivo de rechazo debe tener al menos diez caracteres.',
      );
    }
    const budget = await this.budgetModel.findOneAndUpdate(
      {
        tenantId,
        eventId,
        requests: { $elemMatch: { _id: requestId, status: 'pendiente' } },
      },
      {
        $set: {
          'requests.$.status': 'rechazada',
          'requests.$.decidedBy': user.id,
          'requests.$.decidedAt': new Date(),
          'requests.$.rejectionReason': rejectionReason,
        },
      },
      { new: true, session },
    );
    if (!budget) throw new ConflictException('La solicitud ya fue decidida.');
    const decided = budget.requests.find(
      (item) => item._id.toString() === requestId,
    );
    if (!decided)
      throw new ConflictException('No se pudo consultar la decisión.');
    await this.alerts?.enqueue(
      {
        tenantId,
        recipientId: decided.requestedBy.toString(),
        type: 'budget_decided',
        title: 'Solicitud rechazada',
        message:
          'Tu solicitud fue rechazada; consulta el motivo en el presupuesto.',
        severity: 'info',
        eventId,
        requestId,
        dedupeKey: `decision:${requestId}`,
        permissions: ['eventos.ver', 'presupuestos.ver'],
      },
      session,
    );
    await this.auditsService.record(
      {
        tenantId,
        actor: user,
        module: 'presupuestos',
        action: 'rechazar',
        entity: 'solicitud_presupuesto',
        entityId: decided._id,
        description: 'Rechazó una solicitud de cambio de presupuesto.',
      },
      session,
    );
    return decided;
  }

  private async notify(input: {
    tenantId: string;
    recipientId: string;
    type: string;
    title: string;
    message: string;
    eventId: string;
    requestId: string;
    dedupeKey: string;
    permissions: string[];
  }) {
    if (!this.alerts) return;
    try {
      await this.alerts.emit({ ...input, severity: 'info' });
    } catch (error) {
      this.logger.error(
        'No se pudo registrar la alerta de presupuesto.',
        error,
      );
    }
  }

  private async withDecisionTransaction<T>(
    eventId: string,
    user: AuthenticatedUser,
    action: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const tenantId = this.getTenantId(user);
    if (!isValidObjectId(eventId)) {
      throw new BadRequestException(
        'El identificador del evento no es válido.',
      );
    }
    const session = await this.eventModel.db.startSession();
    try {
      return await session.withTransaction(async () => {
        // Escribir el evento causa conflicto con cambios concurrentes de
        // responsable o estado; solo leerlo dejaría un snapshot obsoleto.
        const locked = await this.eventModel.findOneAndUpdate(
          {
            _id: eventId,
            tenantId,
            responsibleUserId: user.id,
            status: { $ne: 'cancelado' },
            budgetDecisionLock: { $exists: false },
          },
          { $inc: { budgetDecisionRevision: 1 } },
          { new: true, timestamps: false, session },
        );
        if (!locked) {
          const event = await this.eventModel
            .findOne({ _id: eventId, tenantId })
            .session(session);
          if (!event) throw new NotFoundException('El evento no existe.');
          if (event.status === 'cancelado')
            throw new ConflictException(
              'No se pueden decidir solicitudes de un evento cancelado.',
            );
          if (event.responsibleUserId?.toString() !== user.id)
            throw new ForbiddenException(
              'Solo el líder asignado al evento puede decidir esta solicitud.',
            );
          throw new ConflictException(
            'El evento tiene un bloqueo de presupuesto anterior.',
          );
        }
        return action(session);
      });
    } finally {
      await session.endSession();
    }
  }

  private async findDecidableRequest(
    eventId: string,
    requestId: string,
    user: AuthenticatedUser,
    session: ClientSession,
  ) {
    const tenantId = this.getTenantId(user);
    if (!isValidObjectId(requestId)) {
      throw new BadRequestException(
        'El identificador de la solicitud no es válido.',
      );
    }
    const event = await this.eventModel
      .findOne({ _id: eventId, tenantId })
      .session(session);
    if (!event) throw new NotFoundException('El evento no existe.');
    if (event.status === 'cancelado') {
      throw new ConflictException(
        'No se pueden decidir solicitudes de un evento cancelado.',
      );
    }
    if (event.responsibleUserId?.toString() !== user.id) {
      throw new ForbiddenException(
        'Solo el líder asignado al evento puede decidir esta solicitud.',
      );
    }
    const budget = await this.budgetModel
      .findOne({ tenantId, eventId })
      .session(session);
    if (!budget) throw new NotFoundException('El presupuesto no existe.');
    const request = budget.requests.find(
      (item) => item._id.toString() === requestId,
    );
    if (!request) throw new NotFoundException('La solicitud no existe.');
    if (request.status !== 'pendiente') {
      throw new ConflictException('La solicitud ya fue decidida.');
    }
    if (request.requestedBy.toString() === user.id) {
      throw new ForbiddenException('No puedes aprobar tu propia solicitud.');
    }
    return { tenantId, request };
  }

  private async findEvent(eventId: string, tenantId: string) {
    if (!isValidObjectId(eventId)) {
      throw new BadRequestException(
        'El identificador del evento no es válido.',
      );
    }
    const event = await this.eventModel.findOne({ _id: eventId, tenantId });
    if (!event) throw new NotFoundException('El evento no existe.');
    return event;
  }

  private getTenantId(user: AuthenticatedUser): string {
    if (user.scope !== 'tenant' || !user.tenantId) {
      throw new ForbiddenException('Esta acción requiere una empresa activa.');
    }
    return user.tenantId;
  }

  private amounts(budget?: EventBudget | null) {
    const baseAmountCop = budget?.baseAmountCop ?? null;
    const approvedIncreaseCop = budget?.approvedIncreaseCop ?? 0;
    const inventorySpentCop = budget?.inventorySpentCop ?? 0;
    const providerSpentCop = budget?.providerSpentCop ?? 0;
    const extraSpentCop = budget?.extraSpentCop ?? 0;
    const allocatedCop = (baseAmountCop ?? 0) + approvedIncreaseCop;
    const spentCop = inventorySpentCop + providerSpentCop + extraSpentCop;
    return {
      baseAmountCop,
      approvedIncreaseCop,
      allocatedCop,
      inventorySpentCop,
      providerSpentCop,
      extraSpentCop,
      spentCop,
      remainingCop: allocatedCop - spentCop,
    };
  }

  private toRequest(eventId: string, request: EventBudgetRequest) {
    return {
      id: request._id.toString(),
      eventId,
      type: request.type,
      amountCop: request.amountCop,
      reason: request.reason,
      status: request.status,
      requestedBy: request.requestedBy.toString(),
      requestedAt: request.requestedAt,
      decidedBy: request.decidedBy?.toString() ?? null,
      decidedAt: request.decidedAt,
      rejectionReason: request.rejectionReason,
    };
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private isDuplicateKey(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    );
  }
}
