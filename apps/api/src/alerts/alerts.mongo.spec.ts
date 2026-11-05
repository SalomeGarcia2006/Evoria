import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
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
import { Alert, AlertSchema } from './alert.schema';
import { AlertOutbox, AlertOutboxSchema } from './alert-outbox.schema';
import { AlertCondition, AlertConditionSchema } from './alert-condition.schema';
import {
  InventoryItem,
  InventoryItemSchema,
} from '../inventory/schemas/inventory-item.schema';
import { AlertsService } from './alerts.service';
import { FindAlertsDto } from './alerts.dto';
import { EventsService } from '../events/events.service';
import { BudgetsService } from '../budgets/budgets.service';
import { BudgetLedgerService } from '../budgets/budget-ledger.service';
import {
  listDecisionLocks,
  recoverDecisionLock,
} from '../budgets/recover-decision-lock';
import {
  EventResource,
  EventResourceSchema,
} from '../resources/schemas/event-resource.schema';
import { ResourcesService } from '../resources/resources.service';
import { AuditsService } from '../audits/audits.service';
import { AuditLog, AuditLogSchema } from '../audits/schemas/audit-log.schema';
import {
  EventProviderService,
  EventProviderServiceSchema,
} from '../provider-services/schemas/event-provider-service.schema';
import { Provider, ProviderSchema } from '../providers/schemas/provider.schema';

test('Mongo aislado: deduplicación, lectura personal y revocación', async () => {
  const database = `evoria_alertas_test_${new Types.ObjectId().toString()}`;
  assert.match(database, /^evoria_alertas_test_[a-f0-9]{24}$/);
  const mongoHost = process.env.EVORIA_TEST_MONGO_HOST ?? '127.0.0.1:27017';
  const mongoUri = new URL(
    process.env.EVORIA_TEST_MONGO_URI ?? `mongodb://${mongoHost}`,
  );
  mongoUri.pathname = `/${database}`;
  const connection = await createConnection(mongoUri.toString(), {
    serverSelectionTimeoutMS: 5000,
  }).asPromise();
  try {
    const alerts = connection.model(Alert.name, AlertSchema);
    const outbox = connection.model(AlertOutbox.name, AlertOutboxSchema);
    const conditions = connection.model(
      AlertCondition.name,
      AlertConditionSchema,
    );
    const inventory = connection.model(InventoryItem.name, InventoryItemSchema);
    const memberships = connection.model(Membership.name, MembershipSchema);
    const profiles = connection.model(Profile.name, ProfileSchema);
    const permissions = connection.model(Permission.name, PermissionSchema);
    const events = connection.model(Event.name, EventSchema);
    const budgets = connection.model(EventBudget.name, EventBudgetSchema);
    const audits = new AuditsService(
      connection.model(AuditLog.name, AuditLogSchema),
    );
    const resources = connection.model(EventResource.name, EventResourceSchema);
    const providerServices = connection.model(
      EventProviderService.name,
      EventProviderServiceSchema,
    );
    const providers = connection.model(Provider.name, ProviderSchema);
    await Promise.all([alerts.init(), outbox.init(), conditions.init()]);
    const tenant = new Types.ObjectId();
    const owner = new Types.ObjectId();
    const other = new Types.ObjectId();
    const profile = new Types.ObjectId();
    const keys = [
      'alertas.ver',
      'eventos.ver',
      'presupuestos.ver',
      'presupuestos.aprobar',
      'inventario.ver',
      'inventario.editar',
    ];
    const permissionIds = keys.map(() => new Types.ObjectId());
    await connection.collection('permissions').insertMany(
      keys.map((key, index) => ({
        _id: permissionIds[index],
        key,
        status: 'activo',
      })),
    );
    await connection.collection('profiles').insertOne({
      _id: profile,
      tenantId: tenant,
      scope: 'tenant',
      status: 'activo',
      permissionIds,
    });
    await connection.collection('memberships').insertMany(
      [owner, other].map((userId) => ({
        _id: new Types.ObjectId(),
        tenantId: tenant,
        userId,
        profileId: profile,
        status: 'activo',
      })),
    );
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
    const input = {
      tenantId: tenant.toString(),
      recipientId: owner.toString(),
      type: 'budget_decided',
      title: 'Decisión',
      message: 'Decisión disponible',
      severity: 'info' as const,
      dedupeKey: 'decision:example',
      permissions: ['eventos.ver', 'presupuestos.ver'],
    };
    await Promise.all([service.emit(input), service.emit(input)]);
    assert.equal(
      await alerts.countDocuments({ tenantId: tenant, recipientId: owner }),
      1,
    );
    assert.equal(
      await outbox.countDocuments({ tenantId: tenant, recipientId: owner }),
      1,
    );
    const second = { ...input, dedupeKey: 'decision:retry' };
    const originalUpdate = alerts.updateOne;
    Object.defineProperty(alerts, 'updateOne', {
      configurable: true,
      writable: true,
      value: () => Promise.reject(new Error('fallo de escritura simulado')),
    });
    await assert.rejects(() => service.emit(second));
    Object.defineProperty(alerts, 'updateOne', {
      configurable: true,
      writable: true,
      value: originalUpdate,
    });
    assert.equal(
      await outbox.countDocuments({
        dedupeKey: second.dedupeKey,
        deliveredAt: null,
      }),
      1,
    );
    await service.retryPending();
    await service.retryPending();
    assert.equal(
      await alerts.countDocuments({ dedupeKey: second.dedupeKey }),
      1,
    );
    assert.equal(
      await outbox.countDocuments({
        dedupeKey: second.dedupeKey,
        deliveredAt: { $ne: null },
      }),
      1,
    );
    const user = (id: Types.ObjectId) =>
      ({
        id: id.toString(),
        name: 'Persona de prueba',
        tenantId: tenant.toString(),
        scope: 'tenant',
      }) as AuthenticatedUser;
    const alert = await alerts.findOne().lean();
    assert.ok(alert);
    assert.equal(await service.count(user(owner)), 2);
    const query = Object.assign(new FindAlertsDto(), {
      page: 1,
      limit: 1,
      type: 'budget_decided',
      unread: 'true',
    });
    const firstPage = await service.list(user(owner), query);
    assert.equal(firstPage.items.length, 1);
    assert.equal(firstPage.pagination.total, 2);
    assert.equal(firstPage.pagination.totalPages, 2);
    assert.equal((await service.list(user(other), query)).pagination.total, 0);
    await assert.rejects(
      () => service.detail(user(other), alert._id.toString()),
      NotFoundException,
    );
    await assert.rejects(
      () => service.read(user(other), alert._id.toString()),
      NotFoundException,
    );
    const otherTenant = new Types.ObjectId();
    const otherProfile = new Types.ObjectId();
    await connection.collection('profiles').insertOne({
      _id: otherProfile,
      tenantId: otherTenant,
      scope: 'tenant',
      status: 'activo',
      permissionIds,
    });
    await connection.collection('memberships').insertOne({
      _id: new Types.ObjectId(),
      tenantId: otherTenant,
      userId: owner,
      profileId: otherProfile,
      status: 'activo',
    });
    const userInOtherTenant = {
      id: owner.toString(),
      tenantId: otherTenant.toString(),
      scope: 'tenant',
    } as AuthenticatedUser;
    await assert.rejects(
      () => service.read(userInOtherTenant, alert._id.toString()),
      NotFoundException,
    );
    await service.read(user(owner), alert._id.toString());
    assert.equal(await service.count(user(owner)), 1);
    const ledger = new BudgetLedgerService(budgets);
    const budgetService = new BudgetsService(
      budgets,
      events,
      resources,
      inventory,
      providerServices,
      providers,
      ledger,
      audits,
      service,
    );
    const eventService = new EventsService(
      events,
      memberships,
      budgetService,
      audits,
      service,
    );
    const created = await eventService.create(
      {
        name: 'Evento de prueba',
        startAt: '2027-01-01T00:00:00.000Z',
        endAt: '2027-01-02T00:00:00.000Z',
        baseBudget: 1000,
        responsibleUserId: owner.toString(),
      },
      user(other),
    );
    assert.equal(
      await alerts.countDocuments({
        type: 'event_responsibility',
        eventId: new Types.ObjectId(created.id),
        recipientId: owner,
      }),
      1,
    );
    const request = await budgetService.submitRequest(
      created.id,
      { type: 'ampliacion', amountCop: 100, reason: 'Ampliación necesaria' },
      user(other),
    );
    await assert.rejects(
      () =>
        budgetService.submitRequest(
          created.id,
          {
            type: 'ampliacion',
            amountCop: 100,
            reason: 'No puede decidir la propia',
          },
          user(owner),
        ),
      ForbiddenException,
    );
    const originalOutboxUpdate = outbox.updateOne;
    Object.defineProperty(outbox, 'updateOne', {
      configurable: true,
      writable: true,
      value: () => Promise.reject(new Error('fallo temporal de cola')),
    });
    let recoveredRequest: Awaited<
      ReturnType<typeof budgetService.submitRequest>
    >;
    try {
      recoveredRequest = await budgetService.submitRequest(
        created.id,
        {
          type: 'ampliacion',
          amountCop: 100,
          reason: 'Recuperación de alerta pendiente',
        },
        user(other),
      );
    } finally {
      Object.defineProperty(outbox, 'updateOne', {
        configurable: true,
        writable: true,
        value: originalOutboxUpdate,
      });
    }
    assert.equal(
      await alerts.countDocuments({
        type: 'budget_pending',
        requestId: new Types.ObjectId(recoveredRequest.id),
      }),
      0,
    );
    await service.retryPending();
    assert.equal(
      await alerts.countDocuments({
        type: 'budget_pending',
        requestId: new Types.ObjectId(recoveredRequest.id),
        recipientId: owner,
      }),
      1,
    );
    assert.ok(
      (await budgetService.authorizations(user(owner))).some(
        (item) => item.id === request.id,
      ),
    );
    const pendingAlert = await alerts
      .findOne({
        type: 'budget_pending',
        requestId: new Types.ObjectId(request.id),
        recipientId: owner,
      })
      .lean();
    assert.ok(pendingAlert);
    await service.read(user(owner), pendingAlert._id.toString());
    assert.ok(
      (await budgetService.authorizations(user(owner))).some(
        (item) => item.id === request.id,
      ),
    );
    await budgetService.approve(created.id, request.id, user(owner));
    assert.equal(
      await connection.collection('audit_logs').countDocuments({
        tenantId: tenant,
        module: 'eventos',
        action: 'crear',
        entityId: new Types.ObjectId(created.id),
      }),
      1,
    );
    assert.equal(
      await connection.collection('audit_logs').countDocuments({
        tenantId: tenant,
        module: 'presupuestos',
        action: 'aprobar',
        entityId: new Types.ObjectId(request.id),
      }),
      1,
    );
    assert.equal(
      await alerts.countDocuments({
        type: 'budget_decided',
        requestId: new Types.ObjectId(request.id),
        recipientId: other,
      }),
      1,
    );
    await assert.rejects(() =>
      budgetService.approve(created.id, request.id, user(owner)),
    );
    const concurrentRequest = await budgetService.submitRequest(
      created.id,
      { type: 'ampliacion', amountCop: 100, reason: 'Prueba de concurrencia' },
      user(other),
    );
    let enter!: () => void;
    let resume!: () => void;
    const entered = new Promise<void>((resolve) => {
      enter = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const originalFindOneAndUpdate = budgets.findOneAndUpdate;
    const invoke = originalFindOneAndUpdate.bind(budgets) as unknown as (
      ...args: unknown[]
    ) => Promise<unknown>;
    Object.defineProperty(budgets, 'findOneAndUpdate', {
      configurable: true,
      writable: true,
      value: async (...args: unknown[]) => {
        enter();
        await gate;
        return await invoke(...args);
      },
    });
    const deciding = budgetService.approve(
      created.id,
      concurrentRequest.id,
      user(owner),
    );
    await entered;
    try {
      const changing = eventService.update(
        created.id,
        { responsibleUserId: other.toString() },
        user(other),
      );
      resume();
      await deciding;
      await changing;
      await eventService.update(
        created.id,
        { responsibleUserId: owner.toString() },
        user(other),
      );
    } finally {
      resume();
      Object.defineProperty(budgets, 'findOneAndUpdate', {
        configurable: true,
        writable: true,
        value: originalFindOneAndUpdate,
      });
    }
    const interruptedRequest = await budgetService.submitRequest(
      created.id,
      {
        type: 'ampliacion',
        amountCop: 100,
        reason: 'Prueba de proceso interrumpido',
      },
      user(other),
    );
    const workerSource = [
      "require('reflect-metadata');",
      "const { createConnection } = require('mongoose');",
      "const { Event, EventSchema } = require('./src/events/schemas/event.schema');",
      "const { EventBudget, EventBudgetSchema } = require('./src/budgets/schemas/event-budget.schema');",
      "const { BudgetsService } = require('./src/budgets/budgets.service');",
      '(async () => {',
      'const db = await createConnection(process.env.EVORIA_TEST_URI).asPromise();',
      'const events = db.model(Event.name, EventSchema);',
      'const budgets = db.model(EventBudget.name, EventBudgetSchema);',
      "const audits = { record: () => { process.stdout.write('LOCK_ACQUIRED\\n'); return new Promise(() => {}); } };",
      'const service = new BudgetsService(budgets, events, {}, {}, {}, {}, {}, audits);',
      "await service.approve(process.env.EVORIA_TEST_EVENT, process.env.EVORIA_TEST_REQUEST, { id: process.env.EVORIA_TEST_USER, tenantId: process.env.EVORIA_TEST_TENANT, scope: 'tenant' });",
      '})().catch((error) => { process.stderr.write(String(error)); process.exitCode = 1; });',
    ].join('\n');
    const child = spawn(
      process.execPath,
      ['-r', 'ts-node/register', '-e', workerSource],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          EVORIA_TEST_URI: mongoUri.toString(),
          EVORIA_TEST_EVENT: created.id,
          EVORIA_TEST_REQUEST: interruptedRequest.id,
          EVORIA_TEST_USER: owner.toString(),
          EVORIA_TEST_TENANT: tenant.toString(),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    );
    const ready = new Promise<void>((resolve, reject) => {
      let output = '';
      let errors = '';
      const timer = setTimeout(
        () =>
          reject(
            new Error(`El proceso de prueba no adquirió el bloqueo: ${errors}`),
          ),
        20000,
      );
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => {
        errors += chunk;
      });
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        output += chunk;
        if (output.includes('LOCK_ACQUIRED')) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        if (!output.includes('LOCK_ACQUIRED'))
          reject(
            new Error(`El proceso de prueba terminó (${code}): ${errors}`),
          );
      });
    });
    try {
      await ready;
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = once(child, 'exit');
        child.kill();
        await exited;
      }
    }
    const afterCrash = await Promise.allSettled([
      budgetService.approve(created.id, interruptedRequest.id, user(owner)),
      budgetService.approve(created.id, interruptedRequest.id, user(owner)),
    ]);
    assert.equal(
      afterCrash.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    await assert.rejects(
      () =>
        budgetService.approve(created.id, interruptedRequest.id, user(owner)),
      ConflictException,
    );
    const newLead = new Types.ObjectId();
    await connection.collection('memberships').insertOne({
      _id: new Types.ObjectId(),
      tenantId: tenant,
      userId: newLead,
      profileId: profile,
      status: 'activo',
    });
    const secondRequest = await budgetService.submitRequest(
      created.id,
      {
        type: 'ampliacion',
        amountCop: 100,
        reason: 'Otra ampliación necesaria',
      },
      user(other),
    );
    await eventService.update(
      created.id,
      { responsibleUserId: newLead.toString() },
      user(other),
    );
    await assert.rejects(
      () => budgetService.approve(created.id, secondRequest.id, user(owner)),
      ForbiddenException,
    );
    assert.ok(
      (await budgetService.authorizations(user(newLead))).some(
        (item) => item.id === secondRequest.id,
      ),
    );
    assert.equal(
      await alerts.countDocuments({
        type: 'budget_pending',
        requestId: new Types.ObjectId(secondRequest.id),
        recipientId: newLead,
      }),
      1,
    );
    const pendingQuery = Object.assign(new FindAlertsDto(), {
      type: 'budget_pending',
    });
    assert.equal(
      (await service.list(user(owner), pendingQuery)).items.some(
        (item) => item.requestId === secondRequest.id,
      ),
      false,
    );
    assert.equal(
      (await service.list(user(newLead), pendingQuery)).items.some(
        (item) => item.requestId === secondRequest.id,
      ),
      true,
    );
    await budgetService.reject(
      created.id,
      secondRequest.id,
      'No es necesario ahora',
      user(newLead),
    );
    assert.equal(
      await alerts.countDocuments({
        type: 'budget_decided',
        requestId: new Types.ObjectId(secondRequest.id),
        recipientId: other,
      }),
      1,
    );
    const thirdRequest = await budgetService.submitRequest(
      created.id,
      {
        type: 'ampliacion',
        amountCop: 100,
        reason: 'Solicitud pendiente de prueba',
      },
      user(other),
    );
    await eventService.cancel(created.id, user(other));
    await assert.rejects(() =>
      budgetService.approve(created.id, thirdRequest.id, user(newLead)),
    );
    const savedBudget = await budgets
      .findOne({ tenantId: tenant, eventId: created.id })
      .lean();
    assert.equal(
      savedBudget?.requests.find(
        (item) => item._id.toString() === thirdRequest.id,
      )?.status,
      'pendiente',
    );
    assert.equal(
      await alerts.countDocuments({
        type: 'event_cancelled',
        requestId: new Types.ObjectId(thirdRequest.id),
      }),
      2,
    );
    const eventId = new Types.ObjectId();
    await connection.collection('events').insertOne({
      _id: eventId,
      tenantId: tenant,
      responsibleUserId: owner,
      status: 'planificado',
    });
    await connection.collection('event_budgets').insertOne({
      _id: new Types.ObjectId(),
      tenantId: tenant,
      eventId,
      baseAmountCop: 100,
      approvedIncreaseCop: 0,
      inventorySpentCop: 80,
      providerSpentCop: 0,
      extraSpentCop: 0,
      requests: [],
    });
    await Promise.all([
      service.checkBudget(tenant.toString(), eventId.toString()),
      service.checkBudget(tenant.toString(), eventId.toString()),
    ]);
    assert.equal(
      await alerts.countDocuments({ type: 'budget_limit', recipientId: owner }),
      1,
    );
    assert.equal(
      await alerts.countDocuments({ type: 'budget_limit', recipientId: other }),
      0,
    );
    await connection
      .collection('event_budgets')
      .updateOne(
        { tenantId: tenant, eventId },
        { $set: { inventorySpentCop: 50 } },
      );
    await service.checkBudget(tenant.toString(), eventId.toString());
    await connection
      .collection('event_budgets')
      .updateOne(
        { tenantId: tenant, eventId },
        { $set: { inventorySpentCop: 80 } },
      );
    await service.checkBudget(tenant.toString(), eventId.toString());
    assert.equal(
      await alerts.countDocuments({ type: 'budget_limit', recipientId: owner }),
      2,
    );
    const inventoryId = new Types.ObjectId();
    await connection.collection('resources').insertOne({
      _id: inventoryId,
      tenantId: tenant,
      status: 'disponible',
      totalQuantity: 10,
      availableQuantity: 2,
    });
    await service.checkInventory(tenant.toString(), inventoryId.toString());
    await service.checkInventory(tenant.toString(), inventoryId.toString());
    assert.equal(await alerts.countDocuments({ type: 'inventory_low' }), 3);
    await connection
      .collection('resources')
      .updateOne({ _id: inventoryId }, { $set: { availableQuantity: 5 } });
    await service.checkInventory(tenant.toString(), inventoryId.toString());
    await connection
      .collection('resources')
      .updateOne({ _id: inventoryId }, { $set: { availableQuantity: 2 } });
    await service.checkInventory(tenant.toString(), inventoryId.toString());
    assert.equal(await alerts.countDocuments({ type: 'inventory_low' }), 6);
    // El cruce permanece pendiente aunque se recupere antes del reintento.
    const transientItem = new Types.ObjectId();
    await connection.collection('resources').insertOne({
      _id: transientItem,
      tenantId: tenant,
      status: 'disponible',
      totalQuantity: 10,
      availableQuantity: 2,
    });
    const savedOutboxUpdate = outbox.updateOne;
    Object.defineProperty(outbox, 'updateOne', {
      configurable: true,
      writable: true,
      value: () =>
        Promise.reject(new Error('cola no disponible durante el cruce')),
    });
    try {
      await service.refreshThresholds(
        tenant.toString(),
        undefined,
        transientItem.toString(),
      );
    } finally {
      Object.defineProperty(outbox, 'updateOne', {
        configurable: true,
        writable: true,
        value: savedOutboxUpdate,
      });
    }
    await connection
      .collection('resources')
      .updateOne({ _id: transientItem }, { $set: { availableQuantity: 10 } });
    await service.refreshThresholds(
      tenant.toString(),
      undefined,
      transientItem.toString(),
    );
    await service.retryPending();
    assert.equal(
      await alerts.countDocuments({
        type: 'inventory_low',
        inventoryItemId: transientItem,
      }),
      3,
      'cada responsable de inventario recibe el cruce persistido',
    );
    // Si también falla la escritura de la condición, no hay una transición durable.
    const unrecordedItem = new Types.ObjectId();
    await connection.collection('resources').insertOne({
      _id: unrecordedItem,
      tenantId: tenant,
      status: 'disponible',
      totalQuantity: 10,
      availableQuantity: 2,
    });
    const savedConditionCreate = conditions.create;
    Object.defineProperty(conditions, 'create', {
      configurable: true,
      writable: true,
      value: () => Promise.reject(new Error('condición no disponible')),
    });
    try {
      await service.refreshThresholds(
        tenant.toString(),
        undefined,
        unrecordedItem.toString(),
      );
    } finally {
      Object.defineProperty(conditions, 'create', {
        configurable: true,
        writable: true,
        value: savedConditionCreate,
      });
    }
    await connection
      .collection('resources')
      .updateOne({ _id: unrecordedItem }, { $set: { availableQuantity: 10 } });
    await service.refreshThresholds(
      tenant.toString(),
      undefined,
      unrecordedItem.toString(),
    );
    await service.retryPending();
    assert.equal(
      await alerts.countDocuments({
        type: 'inventory_low',
        inventoryItemId: unrecordedItem,
      }),
      0,
      'no se puede reconstruir un cruce que nunca se persistió',
    );
    const activeEvent = await eventService.create(
      {
        name: 'Evento de recursos',
        startAt: '2027-01-01T00:00:00.000Z',
        endAt: '2027-01-02T00:00:00.000Z',
        baseBudget: 1000,
        responsibleUserId: owner.toString(),
      },
      user(other),
    );
    const activeItem = await inventory.create({
      tenantId: tenant,
      name: 'Sillas',
      type: 'Mobiliario',
      unitCost: 100,
      totalQuantity: 10,
      availableQuantity: 10,
      reservedQuantity: 0,
      status: 'disponible',
    });
    const resourceService = new ResourcesService(
      resources,
      inventory,
      events,
      ledger,
      audits,
      service,
    );
    await resourceService.assign(
      activeEvent.id,
      { inventoryItemId: activeItem._id.toString(), quantity: 8 },
      user(other),
    );
    assert.equal(
      await alerts.countDocuments({
        type: 'budget_limit',
        eventId: new Types.ObjectId(activeEvent.id),
        recipientId: owner,
      }),
      1,
    );
    assert.equal(
      await alerts.countDocuments({
        type: 'inventory_low',
        inventoryItemId: activeItem._id,
      }),
      3,
    );
    await resourceService.release(
      activeEvent.id,
      activeItem._id.toString(),
      user(other),
    );
    await resourceService.assign(
      activeEvent.id,
      { inventoryItemId: activeItem._id.toString(), quantity: 8 },
      user(other),
    );
    assert.equal(
      await alerts.countDocuments({
        type: 'budget_limit',
        eventId: new Types.ObjectId(activeEvent.id),
        recipientId: owner,
      }),
      2,
    );
    const ownerUnread = await service.count(user(owner));
    await service.readAll(user(other));
    assert.equal(await service.count(user(owner)), ownerUnread);
    const interruptedToken = new Types.ObjectId().toString();
    await connection
      .collection('events')
      .updateOne(
        { _id: eventId },
        { $set: { budgetDecisionLock: interruptedToken } },
      );
    assert.deepEqual(await listDecisionLocks(connection, tenant.toString()), [
      { eventId: eventId.toString(), token: interruptedToken },
    ]);
    assert.deepEqual(
      await listDecisionLocks(connection, new Types.ObjectId().toString()),
      [],
    );
    await assert.rejects(() =>
      recoverDecisionLock(
        connection,
        new Types.ObjectId().toString(),
        eventId.toString(),
        interruptedToken,
      ),
    );
    await assert.rejects(() =>
      recoverDecisionLock(
        connection,
        tenant.toString(),
        eventId.toString(),
        new Types.ObjectId().toString(),
      ),
    );
    assert.equal(
      (await connection.collection('events').findOne({ _id: eventId }))
        ?.budgetDecisionLock,
      interruptedToken,
    );
    await recoverDecisionLock(
      connection,
      tenant.toString(),
      eventId.toString(),
      interruptedToken,
    );
    assert.deepEqual(
      await listDecisionLocks(connection, tenant.toString()),
      [],
    );
    assert.equal(
      (await connection.collection('events').findOne({ _id: eventId }))
        ?.budgetDecisionLock,
      undefined,
    );
    await connection
      .collection('permissions')
      .updateOne({ key: 'presupuestos.ver' }, { $set: { status: 'inactivo' } });
    await assert.rejects(
      () => service.detail(user(owner), alert._id.toString()),
      NotFoundException,
    );
    await connection
      .collection('permissions')
      .updateOne({ key: 'presupuestos.ver' }, { $set: { status: 'activo' } });
    await connection
      .collection('memberships')
      .updateOne(
        { tenantId: tenant, userId: owner },
        { $set: { status: 'inactivo' } },
      );
    await assert.rejects(
      () => service.detail(user(owner), alert._id.toString()),
      ForbiddenException,
    );
  } finally {
    await connection.dropDatabase();
    await connection.close();
  }
});
