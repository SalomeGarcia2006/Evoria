import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  isValidObjectId,
  type ClientSession,
  type Model,
  Types,
} from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Event } from '../events/schemas/event.schema';
import { EventBudget } from '../budgets/schemas/event-budget.schema';
import { Membership } from '../memberships/schemas/membership.schema';
import { Permission } from '../permissions/schemas/permission.schema';
import { Profile } from '../profiles/schemas/profile.schema';
import { Alert } from './alert.schema';
import { AlertOutbox } from './alert-outbox.schema';
import { AlertCondition } from './alert-condition.schema';
import { InventoryItem } from '../inventory/schemas/inventory-item.schema';
import { isBudgetNearLimit, isInventoryLow } from './thresholds';
import { FindAlertsDto } from './alerts.dto';

type NewAlert = {
  tenantId: string;
  recipientId: string;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning';
  dedupeKey: string;
  eventId?: string;
  requestId?: string;
  inventoryItemId?: string;
  permissions: string[];
};

@Injectable()
export class AlertsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertsService.name);
  private timer?: ReturnType<typeof setInterval>;
  private scanning = false;
  private eventCursor?: Types.ObjectId;
  private budgetCursor?: Types.ObjectId;
  private inventoryCursor?: Types.ObjectId;
  constructor(
    @InjectModel(Alert.name) private readonly alerts: Model<Alert>,
    @InjectModel(Membership.name)
    private readonly memberships: Model<Membership>,
    @InjectModel(Profile.name) private readonly profiles: Model<Profile>,
    @InjectModel(Permission.name)
    private readonly permissions: Model<Permission>,
    @InjectModel(Event.name) private readonly events: Model<Event>,
    @InjectModel(EventBudget.name) private readonly budgets: Model<EventBudget>,
    @InjectModel(AlertOutbox.name) private readonly outbox: Model<AlertOutbox>,
    @InjectModel(AlertCondition.name)
    private readonly conditions: Model<AlertCondition>,
    @InjectModel(InventoryItem.name)
    private readonly inventory: Model<InventoryItem>,
  ) {}

  async onModuleInit() {
    await Promise.all([
      this.alerts.createIndexes(),
      this.outbox.createIndexes(),
      this.conditions.createIndexes(),
    ]);
    void this.retryPending().catch((error: unknown) =>
      this.logger.error('Falló el reintento inicial de alertas.', error),
    );
    this.timer = setInterval(() => {
      void this.retryPending().catch((error: unknown) =>
        this.logger.error('Falló el reintento de alertas.', error),
      );
    }, 15000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async granted(
    tenantId: string,
    recipientId: string,
    session?: ClientSession,
  ): Promise<Set<string>> {
    const membership = await this.memberships
      .findOne({ tenantId, userId: recipientId, status: 'activo' })
      .session(session ?? null)
      .lean();
    if (!membership) return new Set();
    const profile = await this.profiles
      .findOne({
        _id: membership.profileId,
        tenantId,
        scope: 'tenant',
        status: 'activo',
      })
      .session(session ?? null)
      .lean();
    if (!profile) return new Set();
    const permissions = await this.permissions
      .find({ _id: { $in: profile.permissionIds }, status: 'activo' })
      .session(session ?? null)
      .select('key')
      .lean();
    return new Set(permissions.map((permission) => permission.key));
  }

  async emit(input: NewAlert): Promise<void> {
    const granted = await this.granted(input.tenantId, input.recipientId);
    if (
      !['alertas.ver', ...input.permissions].every((permission) =>
        granted.has(permission),
      )
    )
      return;
    const key = {
      tenantId: input.tenantId,
      recipientId: input.recipientId,
      dedupeKey: input.dedupeKey,
    };
    try {
      await this.outbox.updateOne(
        key,
        {
          $setOnInsert: {
            ...key,
            payload: input,
            nextAttemptAt: new Date(),
            deliveredAt: null,
            attempts: 0,
          },
        },
        { upsert: true },
      );
    } catch (error) {
      if (!this.isDuplicate(error)) throw error;
    }
    await this.deliver(input);
    await this.outbox.updateOne(key, { $set: { deliveredAt: new Date() } });
  }

  // La autorización de lectura se comprueba al entregar; esta escritura debe
  // compartir la transacción de la operación que originó la alerta.
  async enqueue(input: NewAlert, session: ClientSession): Promise<void> {
    const key = {
      tenantId: input.tenantId,
      recipientId: input.recipientId,
      dedupeKey: input.dedupeKey,
    };
    await this.outbox.updateOne(
      key,
      {
        $setOnInsert: {
          ...key,
          payload: input,
          nextAttemptAt: new Date(),
          deliveredAt: null,
          attempts: 0,
        },
      },
      { upsert: true, session },
    );
  }

  private async deliver(input: NewAlert): Promise<void> {
    const granted = await this.granted(input.tenantId, input.recipientId);
    if (
      !['alertas.ver', ...input.permissions].every((permission) =>
        granted.has(permission),
      )
    )
      return;
    const record = {
      tenantId: input.tenantId,
      recipientId: input.recipientId,
      type: input.type,
      title: input.title,
      message: input.message,
      severity: input.severity,
      eventId: input.eventId,
      requestId: input.requestId,
      inventoryItemId: input.inventoryItemId,
      dedupeKey: input.dedupeKey,
    };
    try {
      await this.alerts.updateOne(
        {
          tenantId: input.tenantId,
          recipientId: input.recipientId,
          dedupeKey: input.dedupeKey,
        },
        { $setOnInsert: record },
        { upsert: true },
      );
    } catch (error) {
      if (!this.isDuplicate(error)) throw error;
    }
  }

  async retryPending(): Promise<void> {
    if (this.scanning) return;
    this.scanning = true;
    try {
      await this.retryQueued();
      await this.reconcileSources();
    } finally {
      this.scanning = false;
    }
  }

  private async retryQueued(): Promise<void> {
    const pending = await this.outbox
      .find({ deliveredAt: null, nextAttemptAt: { $lte: new Date() } })
      .sort({ nextAttemptAt: 1 })
      .limit(100)
      .lean();
    for (const item of pending) {
      try {
        await this.deliver(item.payload as NewAlert);
        await this.outbox.updateOne(
          { _id: item._id, deliveredAt: null },
          { $set: { deliveredAt: new Date() } },
        );
      } catch (error) {
        await this.outbox.updateOne(
          { _id: item._id, deliveredAt: null },
          {
            $inc: { attempts: 1 },
            $set: { nextAttemptAt: new Date(Date.now() + 30000) },
          },
        );
        this.logger.error(
          'No se pudo entregar una alerta; se reintentará.',
          error,
        );
      }
    }
    const conditions = await this.conditions
      .find({
        $expr: {
          $gt: ['$generation', { $ifNull: ['$enqueuedGeneration', 0] }],
        },
      })
      .limit(100)
      .lean();
    for (const condition of conditions) {
      try {
        await this.flushCondition(condition._id);
      } catch (error) {
        this.logger.error(
          'No se pudo entregar una alerta de umbral; se reintentará.',
          error,
        );
      }
    }
  }

  private async reconcileSources(): Promise<void> {
    const eventBatch = await this.events
      .find({
        ...(this.eventCursor ? { _id: { $gt: this.eventCursor } } : {}),
        responsibleAssignedAt: { $ne: null, $exists: true },
        status: { $ne: 'cancelado' },
      })
      .sort({ _id: 1 })
      .limit(100)
      .lean();
    this.eventCursor =
      eventBatch.length === 100
        ? eventBatch[eventBatch.length - 1]._id
        : undefined;
    for (const event of eventBatch) {
      if (!event.responsibleUserId || !event.responsibleAssignedAt) continue;
      try {
        const tenantId = event.tenantId.toString();
        const eventId = event._id.toString();
        const recipientId = event.responsibleUserId.toString();
        if (
          event.createdAt &&
          event.responsibleAssignedAt.getTime() <= event.createdAt.getTime() &&
          !(await this.budgets.exists({ tenantId, eventId }))
        )
          continue;
        await this.emit({
          tenantId,
          recipientId,
          type: 'event_responsibility',
          title: 'Responsable de evento',
          message: 'Te asignaron como responsable de un evento.',
          severity: 'info',
          eventId,
          dedupeKey: `responsibility:${eventId}:${recipientId}:${event.responsibleAssignedAt.getTime()}`,
          permissions: ['eventos.ver'],
        });
        await this.checkBudget(tenantId, eventId);
      } catch (error) {
        this.logger.error(
          'No se pudo conciliar un evento; se reintentará.',
          error,
        );
      }
    }
    const budgetBatch = await this.budgets
      .find(this.budgetCursor ? { _id: { $gt: this.budgetCursor } } : {})
      .sort({ _id: 1 })
      .limit(100)
      .lean();
    this.budgetCursor =
      budgetBatch.length === 100
        ? budgetBatch[budgetBatch.length - 1]._id
        : undefined;
    for (const budget of budgetBatch) {
      try {
        const tenantId = budget.tenantId.toString();
        const eventId = budget.eventId.toString();
        const event = await this.events
          .findOne({ _id: budget.eventId, tenantId: budget.tenantId })
          .lean();
        if (!event) continue;
        await this.checkBudget(tenantId, eventId);
        for (const request of budget.requests) {
          const requestId = request._id.toString();
          const requester = request.requestedBy.toString();
          const responsible = event.responsibleUserId?.toString();
          if (
            request.status === 'pendiente' &&
            event.status !== 'cancelado' &&
            responsible &&
            responsible !== requester
          ) {
            await this.emit({
              tenantId,
              recipientId: responsible,
              type: 'budget_pending',
              title: 'Solicitud pendiente',
              message:
                'Hay una solicitud de presupuesto pendiente de tu decisión.',
              severity: 'info',
              eventId,
              requestId,
              dedupeKey: `pending:${requestId}:${responsible}`,
              permissions: [
                'eventos.ver',
                'presupuestos.ver',
                'presupuestos.aprobar',
              ],
            });
          } else if (
            request.status === 'pendiente' &&
            event.status === 'cancelado'
          ) {
            for (const recipientId of new Set([
              requester,
              ...(responsible ? [responsible] : []),
            ])) {
              await this.emit({
                tenantId,
                recipientId,
                type: 'event_cancelled',
                title: 'Evento cancelado',
                message:
                  'El evento fue cancelado y su solicitud pendiente no puede aprobarse.',
                severity: 'info',
                eventId,
                requestId,
                dedupeKey: `cancelled:${requestId}:${recipientId}`,
                permissions: ['eventos.ver', 'presupuestos.ver'],
              });
            }
          } else if (
            request.status === 'aprobada' ||
            request.status === 'rechazada'
          ) {
            const approved = request.status === 'aprobada';
            await this.emit({
              tenantId,
              recipientId: requester,
              type: 'budget_decided',
              title: approved ? 'Solicitud aprobada' : 'Solicitud rechazada',
              message: approved
                ? 'Tu solicitud de presupuesto fue aprobada.'
                : 'Tu solicitud fue rechazada; consulta el motivo en el presupuesto.',
              severity: 'info',
              eventId,
              requestId,
              dedupeKey: `decision:${requestId}`,
              permissions: ['eventos.ver', 'presupuestos.ver'],
            });
          }
        }
      } catch (error) {
        this.logger.error(
          'No se pudo conciliar un presupuesto; se reintentará.',
          error,
        );
      }
    }
    const inventoryBatch = await this.inventory
      .find(this.inventoryCursor ? { _id: { $gt: this.inventoryCursor } } : {})
      .sort({ _id: 1 })
      .limit(100)
      .lean();
    this.inventoryCursor =
      inventoryBatch.length === 100
        ? inventoryBatch[inventoryBatch.length - 1]._id
        : undefined;
    for (const item of inventoryBatch) {
      try {
        await this.checkInventory(
          item.tenantId.toString(),
          item._id.toString(),
        );
      } catch (error) {
        this.logger.error(
          'No se pudo conciliar inventario; se reintentará.',
          error,
        );
      }
    }
  }

  private threshold(name: string, fallback: number): number {
    const value = Number(process.env[name] ?? fallback);
    return Number.isFinite(value) && value > 0 && value <= 100
      ? value
      : fallback;
  }

  private async observe(
    input: NewAlert,
    session?: ClientSession,
  ): Promise<void> {
    const key = {
      tenantId: input.tenantId,
      recipientId: input.recipientId,
      key: input.dedupeKey,
    };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const previous = await this.conditions
        .findOne(key)
        .session(session ?? null)
        .lean();
      if (!previous) {
        try {
          const [created] = await this.conditions.create(
            [
              {
                ...key,
                active: true,
                generation: 1,
                payload: input,
              },
            ],
            session ? { session } : {},
          );
          if (!session) await this.flushCondition(created._id);
          return;
        } catch (error) {
          if (!session && this.isDuplicate(error)) continue;
          throw error;
        }
      }
      if (previous.active) {
        if (!session) await this.flushCondition(previous._id);
        return;
      }
      const changed = await this.conditions.updateOne(
        { _id: previous._id, active: false, generation: previous.generation },
        { $set: { active: true, payload: input }, $inc: { generation: 1 } },
        { session },
      );
      if (changed.modifiedCount === 1) {
        if (!session) await this.flushCondition(previous._id);
        return;
      }
    }
    throw new Error('No se pudo registrar el cruce de umbral.');
  }

  private async flushCondition(id: Types.ObjectId): Promise<void> {
    for (let batch = 0; batch < 100; batch += 1) {
      const condition = await this.conditions.findById(id).lean();
      if (!condition) return;
      const next = (condition.enqueuedGeneration ?? 0) + 1;
      if (next > condition.generation) return;
      const payload = condition.payload as NewAlert;
      await this.emit({
        ...payload,
        dedupeKey: `${payload.dedupeKey}:${next}`,
      });
      await this.conditions.updateOne(
        { _id: id },
        { $max: { enqueuedGeneration: next } },
      );
    }
  }

  async checkBudget(
    tenantId: string,
    eventId: string,
    session?: ClientSession,
  ): Promise<void> {
    const key = `budget-limit:${eventId}`;
    const event = await this.events
      .findOne({ _id: eventId, tenantId })
      .session(session ?? null)
      .lean();
    const budget = await this.budgets
      .findOne({ tenantId, eventId })
      .session(session ?? null)
      .lean();
    const recipientId = event?.responsibleUserId?.toString();
    const assigned = budget
      ? budget.baseAmountCop + budget.approvedIncreaseCop
      : null;
    const spent = budget
      ? budget.inventorySpentCop +
        budget.providerSpentCop +
        budget.extraSpentCop
      : 0;
    if (
      !recipientId ||
      event?.status === 'cancelado' ||
      !isBudgetNearLimit(
        assigned,
        spent,
        this.threshold('ALERT_BUDGET_PERCENT', 80),
      )
    ) {
      await this.conditions.updateMany(
        { tenantId, key, active: true },
        { $set: { active: false } },
        { session },
      );
      return;
    }
    await this.conditions.updateMany(
      { tenantId, key, recipientId: { $ne: recipientId }, active: true },
      { $set: { active: false } },
      { session },
    );
    await this.observe(
      {
        tenantId,
        recipientId,
        type: 'budget_limit',
        title: 'Presupuesto cercano al límite',
        message: 'El presupuesto de tu evento se acerca al límite.',
        severity: 'warning',
        eventId,
        dedupeKey: key,
        permissions: ['eventos.ver', 'presupuestos.ver'],
      },
      session,
    );
  }

  async checkInventory(
    tenantId: string,
    inventoryItemId: string,
    session?: ClientSession,
  ): Promise<void> {
    const key = `inventory-low:${inventoryItemId}`;
    const item = await this.inventory
      .findOne({ _id: inventoryItemId, tenantId })
      .session(session ?? null)
      .lean();
    if (
      !item ||
      item.status !== 'disponible' ||
      !isInventoryLow(
        item.totalQuantity,
        item.availableQuantity,
        this.threshold('ALERT_INVENTORY_PERCENT', 20),
      )
    ) {
      await this.conditions.updateMany(
        { tenantId, key, active: true },
        { $set: { active: false } },
        { session },
      );
      return;
    }
    const memberships = await this.memberships
      .find({ tenantId, status: 'activo' })
      .session(session ?? null)
      .select('userId')
      .lean();
    for (const membership of memberships) {
      const recipientId = membership.userId.toString();
      const granted = await this.granted(tenantId, recipientId, session);
      if (
        !['alertas.ver', 'inventario.ver', 'inventario.editar'].every(
          (permission) => granted.has(permission),
        )
      )
        continue;
      try {
        await this.observe(
          {
            tenantId,
            recipientId,
            type: 'inventory_low',
            title: 'Inventario bajo',
            message:
              'Un recurso de inventario tiene pocas unidades disponibles.',
            severity: 'warning',
            inventoryItemId,
            dedupeKey: key,
            permissions: ['inventario.ver', 'inventario.editar'],
          },
          session,
        );
      } catch (error) {
        if (session) throw error;
        this.logger.error('No se pudo encolar el umbral de inventario.', error);
      }
    }
  }

  async refreshThresholds(
    tenantId: string,
    eventId?: string,
    inventoryItemId?: string,
  ): Promise<void> {
    try {
      if (eventId) await this.checkBudget(tenantId, eventId);
      if (inventoryItemId) await this.checkInventory(tenantId, inventoryItemId);
    } catch (error) {
      this.logger.error('No se pudo evaluar el umbral.', error);
    }
  }

  private isDuplicate(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    );
  }

  private async filter(user: AuthenticatedUser, query?: FindAlertsDto) {
    if (user.scope !== 'tenant' || !user.tenantId)
      throw new ForbiddenException('Esta acción requiere una empresa activa.');
    const granted = await this.granted(user.tenantId, user.id);
    if (!granted.has('alertas.ver'))
      throw new ForbiddenException('No tienes permiso para consultar alertas.');
    const allowed: string[] = [];
    if (granted.has('eventos.ver')) allowed.push('event_responsibility');
    if (granted.has('eventos.ver') && granted.has('presupuestos.ver'))
      allowed.push('budget_decided', 'event_cancelled', 'budget_limit');
    if (
      granted.has('eventos.ver') &&
      granted.has('presupuestos.ver') &&
      granted.has('presupuestos.aprobar')
    )
      allowed.push('budget_pending');
    if (granted.has('inventario.ver') && granted.has('inventario.editar'))
      allowed.push('inventory_low');
    const events = await this.events
      .find({
        tenantId: user.tenantId,
        responsibleUserId: user.id,
        status: { $ne: 'cancelado' },
      })
      .select('_id')
      .lean();
    const eventIds = events.map((event) => event._id);
    const budgets = await this.budgets
      .find({
        tenantId: user.tenantId,
        eventId: { $in: eventIds },
        'requests.status': 'pendiente',
      })
      .select('requests')
      .lean();
    const pendingIds = budgets.flatMap((budget) =>
      budget.requests
        .filter(
          (request) =>
            request.status === 'pendiente' &&
            request.requestedBy.toString() !== user.id,
        )
        .map((request) => request._id),
    );
    return {
      tenantId: user.tenantId,
      recipientId: user.id,
      type: query?.type
        ? { $in: allowed.filter((type) => type === query.type) }
        : { $in: allowed },
      $or: [
        {
          type: {
            $nin: ['budget_pending', 'budget_limit', 'event_responsibility'],
          },
        },
        {
          type: { $in: ['budget_limit', 'event_responsibility'] },
          eventId: { $in: eventIds },
        },
        {
          type: 'budget_pending',
          eventId: { $in: eventIds },
          requestId: { $in: pendingIds },
        },
      ],
      ...(query?.unread === 'true'
        ? { readAt: null }
        : query?.unread === 'false'
          ? { readAt: { $ne: null } }
          : {}),
      ...(query?.severity ? { severity: query.severity } : {}),
      ...(query?.eventId ? { eventId: query.eventId } : {}),
    };
  }

  private serialize(alert: Alert & { _id: { toString(): string } }) {
    return {
      id: alert._id.toString(),
      type: alert.type,
      title: alert.title,
      message: alert.message,
      severity: alert.severity,
      eventId: alert.eventId?.toString() ?? null,
      requestId: alert.requestId?.toString() ?? null,
      inventoryItemId: alert.inventoryItemId?.toString() ?? null,
      readAt: alert.readAt,
      createdAt: alert.createdAt,
    };
  }

  async list(user: AuthenticatedUser, query: FindAlertsDto) {
    const filter = await this.filter(user, query);
    const [items, total] = await Promise.all([
      this.alerts
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.alerts.countDocuments(filter),
    ]);
    return {
      items: items.map((item) => this.serialize(item)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
  async count(user: AuthenticatedUser) {
    return this.alerts.countDocuments({
      ...(await this.filter(user)),
      readAt: null,
    });
  }
  async detail(user: AuthenticatedUser, id: string) {
    if (!isValidObjectId(id))
      throw new BadRequestException('El identificador de alerta no es válido.');
    const item = await this.alerts
      .findOne({ ...(await this.filter(user)), _id: id })
      .lean();
    if (!item) throw new NotFoundException('La alerta no existe.');
    return this.serialize(item);
  }
  async read(user: AuthenticatedUser, id: string) {
    if (!isValidObjectId(id))
      throw new BadRequestException('El identificador de alerta no es válido.');
    const filter = { ...(await this.filter(user)), _id: id };
    const item = await this.alerts
      .findOneAndUpdate(
        { ...filter, readAt: null },
        { $set: { readAt: new Date() } },
        { new: true },
      )
      .lean();
    if (item) return this.serialize(item);
    return this.detail(user, id);
  }
  async readAll(user: AuthenticatedUser) {
    const result = await this.alerts.updateMany(
      { ...(await this.filter(user)), readAt: null },
      { $set: { readAt: new Date() } },
    );
    return result.modifiedCount;
  }
}
