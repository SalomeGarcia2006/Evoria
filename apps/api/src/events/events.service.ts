import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  Error as MongooseError,
  isValidObjectId,
  type Model,
  type Types,
} from 'mongoose';
import { Membership } from '../memberships/schemas/membership.schema';
import { BudgetsService } from '../budgets/budgets.service';
import { AlertsService } from '../alerts/alerts.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditsService } from '../audits/audits.service';
import { CreateEventDto } from './dto/create-event.dto';
import { FindEventsDto } from './dto/find-events.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Event, type EventDocument } from './schemas/event.schema';
import { Tenant } from '../tenants/schemas/tenant.schema';
import { Schedule } from '../schedules/schemas/schedule.schema';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EventClientDto } from './dto/event-client.dto';

const DEFAULT_EVENT_TYPES = [
  'Congreso',
  'Seminario',
  'Taller',
  'Conferencia',
  'Feria',
  'Concierto',
  'Boda',
  'Graduación',
  'Evento corporativo',
  'Lanzamiento de producto',
  'Evento deportivo',
  'Evento benéfico',
];

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  constructor(
    @InjectModel(Event.name) private readonly eventModel: Model<Event>,
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<Membership>,
    private readonly budgetsService: BudgetsService,
    private readonly auditsService: AuditsService,
    @Optional() private readonly alerts?: AlertsService,
    @Optional()
    @InjectModel(Tenant.name)
    private readonly tenantModel?: Model<Tenant>,
    @Optional()
    @InjectModel(Schedule.name)
    private readonly scheduleModel?: Model<Schedule>,
  ) {}

  async eventTypes(user: AuthenticatedUser) {
    const tenantId = this.getTenantId(user);
    const tenant = await this.tenantModel!.findOne({
      _id: tenantId,
      status: 'activo',
    })
      .select('eventTypes')
      .lean();
    if (!tenant)
      throw new ForbiddenException('La empresa activa no está disponible.');
    const types = tenant.eventTypes ?? [];
    return {
      types: types.length ? types : DEFAULT_EVENT_TYPES,
      source: types.length ? 'tenant' : 'default',
    };
  }

  private async validateEventType(
    value: string,
    user: AuthenticatedUser,
  ): Promise<string> {
    const { types } = await this.eventTypes(user);
    const normalized = value
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('es');
    const match = types.find(
      (type) =>
        type.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es') === normalized,
    );
    if (!match)
      throw new BadRequestException(
        'El tipo de evento no está configurado para esta empresa.',
      );
    return match;
  }

  async create(createEventDto: CreateEventDto, user: AuthenticatedUser) {
    const tenantId = this.getTenantId(user);
    const client = this.normalizeClient(createEventDto.client);
    await this.validateResponsible(createEventDto.responsibleUserId, tenantId);
    this.validateDates(createEventDto.startAt, createEventDto.endAt);
    if (createEventDto.status === 'cancelado') {
      throw new BadRequestException('No puedes crear un evento cancelado.');
    }
    if (createEventDto.type !== undefined && !createEventDto.type.trim()) {
      throw new BadRequestException('El tipo de evento no puede estar vacío.');
    }

    const event = await this.eventModel.create({
      tenantId,
      client,
      createdBy: user.id,
      name: createEventDto.name.trim(),
      description: this.trimOptional(createEventDto.description),
      startAt: new Date(createEventDto.startAt),
      endAt: new Date(createEventDto.endAt),
      location: this.trimOptional(createEventDto.location),
      type: createEventDto.type
        ? await this.validateEventType(createEventDto.type, user)
        : null,
      baseBudget: createEventDto.baseBudget,
      invitados: createEventDto.invitados ?? 0,
      status: createEventDto.status,
      responsibleUserId: createEventDto.responsibleUserId ?? null,
      responsibleAssignedAt: createEventDto.responsibleUserId
        ? new Date()
        : null,
    });

    try {
      await this.budgetsService.initializeForEvent(
        event._id.toString(),
        tenantId,
        createEventDto.baseBudget,
        user.id,
      );
    } catch (error) {
      // Una confirmación incierta puede haber guardado el presupuesto. No
      // borrar el evento hasta que un operador pueda comprobar el resultado.
      if (
        typeof error === 'object' &&
        error !== null &&
        'hasErrorLabel' in error &&
        typeof error.hasErrorLabel === 'function' &&
        error.hasErrorLabel('UnknownTransactionCommitResult')
      )
        throw error;
      await event.deleteOne();
      throw error;
    }

    await this.notifyResponsible(event, tenantId);
    await this.auditsService.record({
      tenantId,
      actor: user,
      module: 'eventos',
      action: 'crear',
      entity: 'evento',
      entityId: event._id,
      description: `Creó el evento ${event.name}.`,
    });

    return this.toResponse(event);
  }

  async findAll(query: FindEventsDto, user: AuthenticatedUser) {
    const tenantId = this.getTenantId(user);
    this.validateDates(query.from, query.to);
    const filter = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.from ? { startAt: { $gte: new Date(query.from) } } : {}),
      ...(query.to ? { endAt: { $lte: new Date(query.to) } } : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [events, total] = await Promise.all([
      this.eventModel
        .find(filter)
        .sort({ startAt: 1 })
        .skip(skip)
        .limit(query.limit)
        .lean(),
      this.eventModel.countDocuments(filter),
    ]);

    return {
      items: events.map((event) => this.toResponse(event)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    return this.toResponse(await this.findEvent(id, this.getTenantId(user)));
  }

  async update(
    id: string,
    updateEventDto: UpdateEventDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.getTenantId(user);
    const event = await this.findEvent(id, tenantId);
    const previousResponsible = event.responsibleUserId?.toString() ?? null;
    const previousStatus = event.status;

    if (event.status === 'cancelado') {
      throw new ConflictException('No puedes editar un evento cancelado.');
    }

    const client =
      updateEventDto.client !== undefined
        ? this.normalizeClient(updateEventDto.client)
        : undefined;

    const startAt = updateEventDto.startAt ?? event.startAt.toISOString();
    const endAt = updateEventDto.endAt ?? event.endAt.toISOString();
    this.validateDates(startAt, endAt);
    const eventRevision = event.teamAssignmentRevision ?? 0;
    const datesChanged =
      updateEventDto.startAt !== undefined ||
      updateEventDto.endAt !== undefined;
    const responsibleChanged =
      updateEventDto.responsibleUserId !== undefined &&
      (updateEventDto.responsibleUserId ?? null) !== previousResponsible;
    if (
      datesChanged &&
      this.scheduleModel &&
      (await this.scheduleModel.exists({
        tenantId,
        eventId: event._id,
        teamId: { $ne: null },
        status: { $ne: 'cancelado' },
        $or: [
          { startAt: { $lt: new Date(startAt) } },
          { endAt: { $gt: new Date(endAt) } },
        ],
      }))
    )
      throw new ConflictException(
        'El nuevo período deja actividades asignadas fuera del evento.',
      );
    if (
      responsibleChanged &&
      this.scheduleModel &&
      (await this.scheduleModel.exists({
        tenantId,
        eventId: event._id,
        teamId: { $ne: null },
        status: { $ne: 'cancelado' },
        endAt: { $gt: new Date() },
      }))
    ) {
      if (
        !updateEventDto.responsibleUserId ||
        !this.alerts ||
        !(await this.alerts.canReceiveActivityAlerts(
          tenantId,
          updateEventDto.responsibleUserId,
        ))
      )
        throw new ConflictException(
          'El nuevo responsable debe poder consultar eventos y alertas mientras existan actividades asignadas.',
        );
    }

    const name = updateEventDto.name?.trim();
    if (name !== undefined && (name.length < 2 || name.length > 120)) {
      throw new BadRequestException(
        'El nombre del evento debe tener entre 2 y 120 caracteres.',
      );
    }

    if (
      updateEventDto.baseBudget !== undefined &&
      updateEventDto.baseBudget !== event.baseBudget
    ) {
      throw new ConflictException(
        'El presupuesto base no se puede editar directamente. Solicita una ampliación desde Presupuestos.',
      );
    }

    if (updateEventDto.responsibleUserId !== undefined) {
      await this.validateResponsible(
        updateEventDto.responsibleUserId,
        tenantId,
      );
      event.set('responsibleUserId', updateEventDto.responsibleUserId ?? null);
      if ((updateEventDto.responsibleUserId ?? null) !== previousResponsible) {
        event.responsibleAssignedAt = updateEventDto.responsibleUserId
          ? new Date()
          : null;
      }
    }

    if (name !== undefined) event.name = name;
    if (client !== undefined) event.client = client;
    if (updateEventDto.invitados !== undefined)
      event.invitados = updateEventDto.invitados;
    if (updateEventDto.description !== undefined) {
      event.description = this.trimOptional(updateEventDto.description);
    }
    if (updateEventDto.location !== undefined) {
      event.location = this.trimOptional(updateEventDto.location);
    }
    if (updateEventDto.type !== undefined) {
      const nextType = this.trimOptional(updateEventDto.type);
      if (nextType !== event.type) {
        if (!nextType)
          throw new BadRequestException(
            'El tipo de evento no puede estar vacío.',
          );
        event.type = await this.validateEventType(nextType, user);
      }
    }
    if (updateEventDto.startAt)
      event.startAt = new Date(updateEventDto.startAt);
    if (updateEventDto.endAt) event.endAt = new Date(updateEventDto.endAt);
    if (updateEventDto.status) event.status = updateEventDto.status;

    if (datesChanged || responsibleChanged)
      event.teamAssignmentRevision = eventRevision + 1;

    event.$where = {
      budgetDecisionLock: { $exists: false },
      status: { $ne: 'cancelado' },
      ...(datesChanged || responsibleChanged
        ? {
            teamAssignmentRevision:
              eventRevision === 0 ? { $in: [null, 0] } : eventRevision,
          }
        : {}),
    };
    await this.saveUnlocked(event);
    if (event.responsibleUserId?.toString() !== previousResponsible) {
      await this.notifyResponsible(event, tenantId);
      await this.alerts?.refreshThresholds(tenantId, event._id.toString());
    }
    if (event.status === 'cancelado' && previousStatus !== 'cancelado') {
      await this.notifyCancellation(event, tenantId);
    }
    await this.auditsService.record({
      tenantId,
      actor: user,
      module: 'eventos',
      action: 'editar',
      entity: 'evento',
      entityId: event._id,
      description: `Actualizó el evento ${event.name}.`,
    });
    return this.toResponse(event);
  }

  async cancel(id: string, user: AuthenticatedUser) {
    const tenantId = this.getTenantId(user);
    const event = await this.findEvent(id, tenantId);
    const wasCancelled = event.status === 'cancelado';
    event.status = 'cancelado';
    event.$where = { budgetDecisionLock: { $exists: false } };
    await this.saveUnlocked(event);

    if (!wasCancelled) await this.notifyCancellation(event, tenantId);

    await this.auditsService.record({
      tenantId,
      actor: user,
      module: 'eventos',
      action: 'cancelar',
      entity: 'evento',
      entityId: event._id,
      description: `Canceló el evento ${event.name}.`,
    });

    return this.toResponse(event);
  }

  private getTenantId(user: AuthenticatedUser): string {
    if (user.scope !== 'tenant' || !user.tenantId) {
      throw new ForbiddenException('Esta acción requiere una empresa activa.');
    }

    return user.tenantId;
  }

  private async saveUnlocked(event: EventDocument): Promise<void> {
    try {
      await event.save();
    } catch (error) {
      if (error instanceof MongooseError.DocumentNotFoundError) {
        throw new ConflictException(
          'El evento cambió o tiene una decisión de presupuesto en curso.',
        );
      }
      throw error;
    }
  }

  private async notifyResponsible(event: EventDocument, tenantId: string) {
    const recipientId = event.responsibleUserId?.toString();
    if (!recipientId || !this.alerts) return;
    try {
      await this.alerts.emit({
        tenantId,
        recipientId,
        type: 'event_responsibility',
        title: 'Responsable de evento',
        message: 'Te asignaron como responsable de un evento.',
        severity: 'info',
        eventId: event._id.toString(),
        dedupeKey: `responsibility:${event._id.toString()}:${recipientId}:${event.responsibleAssignedAt?.getTime() ?? 0}`,
        permissions: ['eventos.ver'],
      });
      await this.budgetsService.notifyPendingForResponsible(
        tenantId,
        event._id.toString(),
        recipientId,
      );
    } catch (error) {
      this.logger.error(
        'No se pudo registrar la alerta de responsable.',
        error,
      );
    }
  }

  private async notifyCancellation(event: EventDocument, tenantId: string) {
    if (!this.alerts) return;
    try {
      await this.budgetsService.notifyCancelledRequests(
        tenantId,
        event._id.toString(),
        event.responsibleUserId?.toString() ?? null,
      );
    } catch (error) {
      this.logger.error(
        'No se pudo registrar la alerta de cancelación.',
        error,
      );
    }
  }

  private async findEvent(
    id: string,
    tenantId: string,
  ): Promise<EventDocument> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException(
        'El identificador del evento no es válido.',
      );
    }

    const event = await this.eventModel.findOne({ _id: id, tenantId });

    if (!event) {
      throw new NotFoundException('El evento no existe.');
    }

    return event;
  }

  private async validateResponsible(
    responsibleUserId: string | null | undefined,
    tenantId: string,
  ): Promise<void> {
    if (!responsibleUserId) return;

    const membership = await this.membershipModel.exists({
      userId: responsibleUserId,
      tenantId,
      status: 'activo',
    });

    if (!membership) {
      throw new BadRequestException(
        'El responsable debe pertenecer a la empresa activa.',
      );
    }
  }

  private validateDates(startAt?: string, endAt?: string): void {
    if (!startAt || !endAt) return;

    if (new Date(endAt) < new Date(startAt)) {
      throw new BadRequestException(
        'La fecha de finalización debe ser posterior a la fecha de inicio.',
      );
    }
  }

  private trimOptional(value?: string | null): string | null {
    return value?.trim() || null;
  }

  private normalizeClient(value: EventClientDto): EventClientDto {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException(
        'Debes proporcionar los datos completos del cliente del evento.',
      );
    }
    const client = plainToInstance(EventClientDto, value);
    if (
      validateSync(client, { whitelist: true, forbidNonWhitelisted: true })
        .length
    ) {
      throw new BadRequestException(
        'Los datos del cliente son inválidos o están incompletos.',
      );
    }
    return {
      name: client.name,
      identification: client.identification,
      phone: client.phone,
      address: client.address,
      email: client.email,
    };
  }

  private toResponse(event: EventDocument | (Event & { _id: Types.ObjectId })) {
    return {
      id: event._id.toString(),
      name: event.name,
      client: event.client
        ? {
            name: event.client.name,
            identification: event.client.identification,
            phone: event.client.phone,
            address: event.client.address,
            email: event.client.email,
          }
        : null,
      description: event.description,
      startAt: event.startAt,
      endAt: event.endAt,
      location: event.location,
      type: event.type,
      baseBudget: event.baseBudget ?? 0,
      invitados: event.invitados ?? 0,
      status: event.status,
      responsibleUserId: event.responsibleUserId?.toString() ?? null,
      createdBy: event.createdBy.toString(),
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }
}
