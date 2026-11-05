import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createConnection, Types } from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Event, EventSchema } from '../events/schemas/event.schema';
import {
  EventBudget,
  EventBudgetSchema,
} from '../budgets/schemas/event-budget.schema';
import {
  Membership,
  MembershipSchema,
} from '../memberships/schemas/membership.schema';
import {
  Permission,
  PermissionSchema,
} from '../permissions/schemas/permission.schema';
import { Profile, ProfileSchema } from '../profiles/schemas/profile.schema';
import {
  InventoryItem,
  InventoryItemSchema,
} from '../inventory/schemas/inventory-item.schema';
import {
  EventResource,
  EventResourceSchema,
} from '../resources/schemas/event-resource.schema';
import {
  EventProviderService,
  EventProviderServiceSchema,
} from '../provider-services/schemas/event-provider-service.schema';
import { Provider, ProviderSchema } from '../providers/schemas/provider.schema';
import { Alert, AlertSchema } from './alert.schema';
import { AlertOutbox, AlertOutboxSchema } from './alert-outbox.schema';
import { AlertCondition, AlertConditionSchema } from './alert-condition.schema';
import { AlertsService } from './alerts.service';
import { BudgetsService } from '../budgets/budgets.service';
import { BudgetLedgerService } from '../budgets/budget-ledger.service';
import { ResourcesService } from '../resources/resources.service';
import { EventsService } from '../events/events.service';
import { ProviderServicesService } from '../provider-services/provider-services.service';
import type { AuditsService } from '../audits/audits.service';

test('servicios reales: cruce transitorio y decisiones en réplica aislada', async () => {
  const database = `evoria_alertas_tx_${new Types.ObjectId().toString()}`;
  const host = process.env.EVORIA_TEST_MONGO_HOST ?? '127.0.0.1:27129';
  const mongoUri = new URL(
    process.env.EVORIA_TEST_MONGO_URI ?? `mongodb://${host}`,
  );
  mongoUri.pathname = `/${database}`;
  const db = await createConnection(mongoUri.toString(), {
    serverSelectionTimeoutMS: 5000,
  }).asPromise();
  try {
    const events = db.model(Event.name, EventSchema);
    const budgets = db.model(EventBudget.name, EventBudgetSchema);
    const inventory = db.model(InventoryItem.name, InventoryItemSchema);
    const assignments = db.model(EventResource.name, EventResourceSchema);
    const providerServices = db.model(
      EventProviderService.name,
      EventProviderServiceSchema,
    );
    const providers = db.model(Provider.name, ProviderSchema);
    const memberships = db.model(Membership.name, MembershipSchema);
    const profiles = db.model(Profile.name, ProfileSchema);
    const permissions = db.model(Permission.name, PermissionSchema);
    const alerts = db.model(Alert.name, AlertSchema);
    const outbox = db.model(AlertOutbox.name, AlertOutboxSchema);
    const conditions = db.model(AlertCondition.name, AlertConditionSchema);
    await Promise.all([
      alerts.init(),
      outbox.init(),
      conditions.init(),
      assignments.init(),
    ]);
    const tenant = new Types.ObjectId();
    const owner = new Types.ObjectId();
    const requester = new Types.ObjectId();
    const profile = new Types.ObjectId();
    const keys = [
      'alertas.ver',
      'eventos.ver',
      'presupuestos.ver',
      'presupuestos.aprobar',
      'inventario.ver',
      'inventario.editar',
    ];
    const ids = keys.map(() => new Types.ObjectId());
    await db
      .collection('permissions')
      .insertMany(
        keys.map((key, index) => ({ _id: ids[index], key, status: 'activo' })),
      );
    await db.collection('profiles').insertOne({
      _id: profile,
      tenantId: tenant,
      scope: 'tenant',
      status: 'activo',
      permissionIds: ids,
    });
    await db.collection('memberships').insertMany(
      [owner, requester].map((userId) => ({
        _id: new Types.ObjectId(),
        tenantId: tenant,
        userId,
        profileId: profile,
        status: 'activo',
      })),
    );
    const event = await events.create({
      tenantId: tenant,
      name: 'Evento aislado',
      startAt: new Date(),
      endAt: new Date(Date.now() + 86_400_000),
      baseBudget: 1000,
      status: 'borrador',
      responsibleUserId: owner,
      createdBy: requester,
    });
    await budgets.create({
      tenantId: tenant,
      eventId: event._id,
      baseAmountCop: 1000,
      createdBy: requester,
    });
    const item = await inventory.create({
      tenantId: tenant,
      name: 'Sillas',
      type: 'Mobiliario',
      unitCost: 100,
      totalQuantity: 10,
      availableQuantity: 10,
      reservedQuantity: 0,
      status: 'disponible',
    });
    const service = new AlertsService(
      alerts,
      memberships,
      profiles,
      permissions,
      events,
      budgets,
      outbox,
      conditions,
      inventory,
    );
    const secondProcessor = new AlertsService(
      alerts,
      memberships,
      profiles,
      permissions,
      events,
      budgets,
      outbox,
      conditions,
      inventory,
    );
    const audit = { record: async () => undefined } as unknown as AuditsService;
    const ledger = new BudgetLedgerService(budgets);
    const resources = new ResourcesService(
      assignments,
      inventory,
      events,
      ledger,
      audit,
      service,
    );
    const budget = new BudgetsService(
      budgets,
      events,
      assignments,
      inventory,
      providerServices,
      providers,
      ledger,
      audit,
      service,
    );
    const eventService = new EventsService(
      events,
      memberships,
      budget,
      audit,
      service,
    );
    const user = (id: Types.ObjectId) =>
      ({
        id: id.toString(),
        tenantId: tenant.toString(),
        scope: 'tenant',
      }) as AuthenticatedUser;

    const originalConditionCreate = conditions.create;
    Object.defineProperty(conditions, 'create', {
      configurable: true,
      writable: true,
      value: () => Promise.reject(new Error('fallo al guardar condición')),
    });
    try {
      await assert.rejects(
        () =>
          resources.assign(
            event._id.toString(),
            { inventoryItemId: item._id.toString(), quantity: 8 },
            user(requester),
          ),
        /fallo al guardar condición/,
      );
    } finally {
      Object.defineProperty(conditions, 'create', {
        configurable: true,
        writable: true,
        value: originalConditionCreate,
      });
    }
    assert.equal((await inventory.findById(item._id))?.availableQuantity, 10);
    assert.equal(
      (await budgets.findOne({ eventId: event._id }))?.inventorySpentCop,
      0,
    );
    assert.equal(await assignments.countDocuments({ eventId: event._id }), 0);

    const original = alerts.updateOne;
    Object.defineProperty(alerts, 'updateOne', {
      configurable: true,
      writable: true,
      value: () => Promise.reject(new Error('entrega interrumpida')),
    });
    try {
      await resources.assign(
        event._id.toString(),
        { inventoryItemId: item._id.toString(), quantity: 8 },
        user(requester),
      );
      await resources.release(
        event._id.toString(),
        item._id.toString(),
        user(requester),
      );
    } finally {
      Object.defineProperty(alerts, 'updateOne', {
        configurable: true,
        writable: true,
        value: original,
      });
    }
    await Promise.all([service.retryPending(), secondProcessor.retryPending()]);
    await service.retryPending();
    assert.equal(
      await alerts.countDocuments({ type: 'budget_limit', recipientId: owner }),
      1,
    );
    assert.equal(
      await alerts.countDocuments({
        type: 'inventory_low',
        inventoryItemId: item._id,
      }),
      2,
    );
    assert.equal((await inventory.findById(item._id))?.availableQuantity, 10);
    assert.equal(
      (await budgets.findOne({ eventId: event._id }))?.inventorySpentCop,
      0,
    );

    const provider = await providers.create({
      tenantId: tenant,
      name: 'Proveedor de prueba',
      categoryKeys: ['espacios'],
      status: 'activo',
      createdBy: requester,
    });
    const providerService = new ProviderServicesService(
      providerServices,
      providers,
      events,
      ledger,
      audit,
      service,
    );
    Object.defineProperty(alerts, 'updateOne', {
      configurable: true,
      writable: true,
      value: () => Promise.reject(new Error('entrega interrumpida')),
    });
    try {
      const reserved = await providerService.create(
        event._id.toString(),
        {
          providerId: provider._id.toString(),
          serviceName: 'Servicio de prueba',
          startDate: '2027-01-01',
          agreedAmountCop: 800,
        },
        user(requester),
      );
      await providerService.cancel(
        event._id.toString(),
        reserved.id,
        user(requester),
      );
    } finally {
      Object.defineProperty(alerts, 'updateOne', {
        configurable: true,
        writable: true,
        value: original,
      });
    }
    await Promise.all([service.retryPending(), secondProcessor.retryPending()]);
    assert.equal(
      await alerts.countDocuments({ type: 'budget_limit', recipientId: owner }),
      2,
    );
    assert.equal(
      (await budgets.findOne({ eventId: event._id }))?.providerSpentCop,
      0,
    );

    const request = await budget.submitRequest(
      event._id.toString(),
      { type: 'ampliacion', amountCop: 100, reason: 'Ampliación para prueba' },
      user(requester),
    );
    const decisions = await Promise.allSettled([
      budget.approve(event._id.toString(), request.id, user(owner)),
      budget.approve(event._id.toString(), request.id, user(owner)),
    ]);
    assert.equal(
      decisions.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      (await budgets.findOne({ eventId: event._id }))?.approvedIncreaseCop,
      100,
    );
    await service.retryPending();
    assert.equal(
      await alerts.countDocuments({
        type: 'budget_decided',
        recipientId: requester,
      }),
      1,
    );
    if (process.env.EVORIA_TEST_FAILPOINTS === '1') {
      assert.equal(
        mongoUri.host,
        '127.0.0.1:27129',
        'los fallos simulados solo pueden usarse en la réplica local aislada',
      );
      const uncertain = await budget.submitRequest(
        event._id.toString(),
        { type: 'ampliacion', amountCop: 70, reason: 'Confirmación incierta' },
        user(requester),
      );
      const configured = await db.db!.admin().command({
        configureFailPoint: 'failCommand',
        mode: { times: 1 },
        data: { failCommands: ['commitTransaction'], closeConnection: true },
      });
      try {
        const result = await budget.approve(
          event._id.toString(),
          uncertain.id,
          user(owner),
        );
        assert.equal(result.status, 'aprobada');
      } finally {
        const disabled = await db
          .db!.admin()
          .command({ configureFailPoint: 'failCommand', mode: 'off' });
        assert.ok(
          disabled.count > configured.count,
          'el fallo de commit debe haberse activado',
        );
      }
      assert.equal(
        (await budgets.findOne({ eventId: event._id }))?.approvedIncreaseCop,
        170,
      );
      await service.retryPending();
      assert.equal(
        await alerts.countDocuments({
          dedupeKey: `decision:${uncertain.id}`,
          recipientId: requester,
        }),
        1,
      );
      assert.equal(
        await outbox.countDocuments({
          dedupeKey: `decision:${uncertain.id}`,
          recipientId: requester,
        }),
        1,
      );
      const acknowledged = await budget.submitRequest(
        event._id.toString(),
        {
          type: 'ampliacion',
          amountCop: 50,
          reason: 'Fallo al confirmar escritura',
        },
        user(requester),
      );
      const writeConcernFailure = await db.db!.admin().command({
        configureFailPoint: 'failCommand',
        mode: { times: 1 },
        data: {
          failCommands: ['commitTransaction'],
          writeConcernError: {
            code: 64,
            errmsg: 'confirmación simulada incierta',
          },
          errorLabels: ['UnknownTransactionCommitResult'],
        },
      });
      try {
        const result = await budget.approve(
          event._id.toString(),
          acknowledged.id,
          user(owner),
        );
        assert.equal(result.status, 'aprobada');
      } finally {
        const disabled = await db
          .db!.admin()
          .command({ configureFailPoint: 'failCommand', mode: 'off' });
        assert.ok(disabled.count > writeConcernFailure.count);
      }
      assert.equal(
        (await budgets.findOne({ eventId: event._id }))?.approvedIncreaseCop,
        220,
      );
      assert.equal(
        await outbox.countDocuments({
          dedupeKey: `decision:${acknowledged.id}`,
          recipientId: requester,
        }),
        1,
      );
      await service.retryPending();
      assert.equal(
        await alerts.countDocuments({
          dedupeKey: `decision:${acknowledged.id}`,
          recipientId: requester,
        }),
        1,
      );
    }
    for (const change of ['responsible', 'cancel'] as const) {
      await events.updateOne(
        { _id: event._id },
        { $set: { status: 'borrador', responsibleUserId: owner } },
      );
      const pending = await budget.submitRequest(
        event._id.toString(),
        {
          type: 'ampliacion',
          amountCop: 50,
          reason: 'Cambio concurrente de evento',
        },
        user(requester),
      );
      const originalGuard = events.findOneAndUpdate;
      const invoke = originalGuard.bind(events) as (
        ...args: unknown[]
      ) => Promise<unknown>;
      let entered!: () => void;
      let resume!: () => void;
      const reached = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const proceed = new Promise<void>((resolve) => {
        resume = resolve;
      });
      Object.defineProperty(events, 'findOneAndUpdate', {
        configurable: true,
        writable: true,
        value: async (...args: unknown[]) => {
          entered();
          await proceed;
          return invoke(...args);
        },
      });
      const deciding = budget.approve(
        event._id.toString(),
        pending.id,
        user(owner),
      );
      try {
        await reached;
        if (change === 'responsible')
          await eventService.update(
            event._id.toString(),
            { responsibleUserId: requester.toString() },
            user(requester),
          );
        else await eventService.cancel(event._id.toString(), user(requester));
        resume();
        await assert.rejects(deciding);
        const saved = await budgets.findOne({ eventId: event._id });
        assert.equal(
          saved?.requests.find((item) => item._id.toString() === pending.id)
            ?.status,
          'pendiente',
        );
      } finally {
        resume();
        Object.defineProperty(events, 'findOneAndUpdate', {
          configurable: true,
          writable: true,
          value: originalGuard,
        });
      }
    }
  } finally {
    await db.dropDatabase();
    await db.close();
  }
});
