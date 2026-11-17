import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import {
  createHttpTestApi,
  createTenantTestContext,
  type HttpSession,
} from '../testing/http-test-api';

test('HTTP: reportes filtran, calculan y aíslan datos por empresa y permisos', async () => {
  const api = await createHttpTestApi('reports_test');
  try {
    const context = await createTenantTestContext(api);
    const owner = context.ownerSession as HttpSession<{ user: { id: string } }>;
    const tenant = new Types.ObjectId(context.tenantId);
    const event = new Types.ObjectId();
    const cancelled = new Types.ObjectId();
    const noBudget = new Types.ObjectId();
    const secondTenantResponse = await api.request('tenants', {
      method: 'POST',
      session: context.developerSession,
      body: {
        name: 'Empresa adicional',
        nit: '900123457-8',
        ownerName: 'Otra persona',
        ownerEmail: 'other-reports@example.test',
        ownerPassword: 'Prueba-segura1',
      },
    });
    assert.equal(secondTenantResponse.status, 201);
    const secondTenant = (await secondTenantResponse.json()) as {
      data: { id: string };
    };
    const otherTenant = new Types.ObjectId(secondTenant.data.id);
    const otherOwner = await api.login(
      'other-reports@example.test',
      'Prueba-segura1',
    );
    const foreignEvent = new Types.ObjectId();
    const inventoryId = new Types.ObjectId();
    const providerId = new Types.ObjectId();
    const creator = new Types.ObjectId(owner.data.user.id);
    const eventDoc = (
      id: Types.ObjectId,
      tenantId: Types.ObjectId,
      status: string,
      name: string,
      date: string,
    ) => ({
      _id: id,
      tenantId,
      name,
      status,
      type: 'feria',
      startAt: new Date(date),
      endAt: new Date(new Date(date).getTime() + 3_600_000),
      createdBy: creator,
      invitados: 5,
      responsibleUserId: creator,
    });
    await api.connection
      .collection('events')
      .insertMany([
        eventDoc(
          event,
          tenant,
          'planificado',
          '=SUM(1,1)',
          '2030-03-10T10:00:00Z',
        ),
        eventDoc(
          cancelled,
          tenant,
          'cancelado',
          'Cancelado',
          '2030-04-10T10:00:00Z',
        ),
        eventDoc(
          noBudget,
          tenant,
          'borrador',
          'Sin presupuesto',
          '2030-05-10T10:00:00Z',
        ),
        eventDoc(
          foreignEvent,
          otherTenant,
          'planificado',
          'Otra empresa',
          '2030-03-10T10:00:00Z',
        ),
      ]);
    await api.connection.collection('event_budgets').insertMany([
      {
        _id: new Types.ObjectId(),
        tenantId: tenant,
        eventId: event,
        baseAmountCop: 1000,
        approvedIncreaseCop: 200,
        inventorySpentCop: 300,
        providerSpentCop: 200,
        extraSpentCop: 100,
        requests: [],
        createdBy: creator,
      },
      {
        _id: new Types.ObjectId(),
        tenantId: tenant,
        eventId: cancelled,
        baseAmountCop: 900,
        approvedIncreaseCop: 0,
        inventorySpentCop: 0,
        providerSpentCop: 0,
        extraSpentCop: 0,
        requests: [],
        createdBy: creator,
      },
      {
        _id: new Types.ObjectId(),
        tenantId: otherTenant,
        eventId: foreignEvent,
        baseAmountCop: 999999,
        approvedIncreaseCop: 0,
        inventorySpentCop: 0,
        providerSpentCop: 0,
        extraSpentCop: 0,
        requests: [],
        createdBy: creator,
      },
    ]);
    await api.connection.collection('resources').insertMany([
      {
        _id: inventoryId,
        tenantId: tenant,
        name: 'Sillas',
        type: 'Mobiliario',
        status: 'disponible',
        totalQuantity: 10,
        availableQuantity: 2,
        reservedQuantity: 8,
        unitCost: 100,
      },
      {
        _id: new Types.ObjectId(),
        tenantId: otherTenant,
        name: 'Oculto',
        type: 'Mobiliario',
        status: 'disponible',
        totalQuantity: 999,
        availableQuantity: 999,
        reservedQuantity: 0,
      },
    ]);
    await api.connection.collection('event_resources').insertMany([
      {
        _id: new Types.ObjectId(),
        tenantId: tenant,
        eventId: event,
        inventoryItemId: inventoryId,
        quantity: 8,
        costAmountCop: 300,
        status: 'asignado',
        assignedAt: new Date('2030-03-01'),
      },
      {
        _id: new Types.ObjectId(),
        tenantId: tenant,
        eventId: foreignEvent,
        inventoryItemId: inventoryId,
        quantity: 999,
        status: 'asignado',
        assignedAt: new Date('2030-03-01'),
      },
    ]);
    await api.connection.collection('providers').insertOne({
      _id: providerId,
      tenantId: tenant,
      name: 'Proveedor A',
      status: 'activo',
    });
    await api.connection.collection('event_provider_services').insertMany([
      {
        _id: new Types.ObjectId(),
        tenantId: tenant,
        eventId: event,
        providerId,
        status: 'confirmado',
        agreedAmountCop: 200,
      },
      {
        _id: new Types.ObjectId(),
        tenantId: tenant,
        eventId: event,
        providerId,
        status: 'cancelado',
        agreedAmountCop: 50,
      },
      {
        _id: new Types.ObjectId(),
        tenantId: tenant,
        eventId: foreignEvent,
        providerId,
        status: 'confirmado',
        agreedAmountCop: 999999,
      },
    ]);
    await api.connection.collection('schedules').insertMany([
      {
        _id: new Types.ObjectId(),
        tenantId: tenant,
        eventId: event,
        status: 'pendiente',
      },
      {
        _id: new Types.ObjectId(),
        tenantId: tenant,
        eventId: event,
        status: 'completado',
      },
      {
        _id: new Types.ObjectId(),
        tenantId: tenant,
        eventId: foreignEvent,
        status: 'pendiente',
      },
    ]);
    const get = (path: string, session: HttpSession = owner) =>
      api.request(path, { session });
    assert.equal((await api.request('reports/events')).status, 401);
    const events = await get('reports/events?limit=1&page=2');
    assert.equal(events.status, 200);
    const eventsBody = (await events.json()) as {
      data: {
        items: unknown[];
        pagination: { total: number };
        byStatus: Record<string, number>;
        invitados: number;
      };
    };
    assert.equal(eventsBody.data.pagination.total, 3);
    assert.equal(eventsBody.data.items.length, 1);
    assert.equal(eventsBody.data.byStatus.cancelado, 1);
    assert.equal(eventsBody.data.invitados, 15);
    const otherReport = await get(
      `reports/events?eventId=${event.toString()}`,
      otherOwner,
    );
    assert.equal(otherReport.status, 200);
    assert.equal(
      (
        (await otherReport.json()) as {
          data: { pagination: { total: number } };
        }
      ).data.pagination.total,
      0,
    );
    const foreignBudget = (await (
      await get('reports/budgets', otherOwner)
    ).json()) as { data: { totals: { allocatedCop: number } } };
    assert.equal(foreignBudget.data.totals.allocatedCop, 999999);
    const period = (await (
      await get('reports/events?from=2030-04-01&to=2030-05-01')
    ).json()) as { data: { pagination: { total: number } } };
    assert.equal(period.data.pagination.total, 1);
    assert.equal(
      (await get('reports/events?from=2030-06-01&to=2030-01-01')).status,
      400,
    );
    assert.equal((await get('reports/events?eventId=invalid')).status, 400);
    const budgets = await get('reports/budgets');
    assert.equal(budgets.status, 200);
    const budgetBody = (await budgets.json()) as {
      data: {
        items: Array<{ eventId: string; executionPercent: number | null }>;
        pagination: { total: number };
        totals: {
          allocatedCop: number;
          spentCop: number;
          remainingCop: number;
        };
      };
    };
    assert.equal(budgetBody.data.pagination.total, 2);
    assert.equal(budgetBody.data.totals.allocatedCop, 1200);
    assert.equal(budgetBody.data.totals.spentCop, 600);
    assert.equal(budgetBody.data.totals.remainingCop, 600);
    const existingBudgets = (await (await get('budgets')).json()) as {
      data: {
        totals: {
          allocatedCop: number;
          spentCop: number;
          remainingCop: number;
        };
      };
    };
    assert.deepEqual(
      {
        allocatedCop: budgetBody.data.totals.allocatedCop,
        spentCop: budgetBody.data.totals.spentCop,
        remainingCop: budgetBody.data.totals.remainingCop,
      },
      existingBudgets.data.totals,
    );
    const pagedBudget = (await (
      await get('reports/budgets?limit=1&page=2')
    ).json()) as {
      data: { items: unknown[]; totals: { allocatedCop: number } };
    };
    assert.equal(pagedBudget.data.items.length, 1);
    assert.equal(pagedBudget.data.totals.allocatedCop, 1200);
    assert.equal(
      budgetBody.data.items.find((row) => row.eventId === event.toString())
        ?.executionPercent,
      50,
    );
    assert.equal(
      budgetBody.data.items.find((row) => row.eventId === noBudget.toString())
        ?.executionPercent,
      null,
    );
    const included = (await (
      await get('reports/budgets?includeCancelled=true')
    ).json()) as { data: { totals: { allocatedCop: number } } };
    assert.equal(included.data.totals.allocatedCop, 2100);
    const inventory = (await (await get('reports/inventory')).json()) as {
      data: { items: Array<{ lowStock: boolean }>; totals: { total: number } };
    };
    assert.equal(inventory.data.totals.total, 10);
    assert.equal(inventory.data.items[0].lowStock, true);
    assert.equal((await get('reports/inventory?from=2030-01-01')).status, 400);
    assert.equal(
      (await get('reports/events?inventoryStatus=disponible')).status,
      400,
    );
    const resources = (await (await get('reports/resources')).json()) as {
      data: { items: Array<{ quantity: number }> };
    };
    assert.equal(resources.data.items.length, 1);
    assert.equal(resources.data.items[0].quantity, 8);
    const providers = (await (await get('reports/providers')).json()) as {
      data: {
        items: Array<{
          serviceCount: number;
          confirmedAmountCop: number;
          cancelledCount: number;
        }>;
      };
    };
    assert.equal(providers.data.items[0].serviceCount, 2);
    assert.equal(providers.data.items[0].confirmedAmountCop, 200);
    assert.equal(providers.data.items[0].cancelledCount, 1);
    const schedules = (await (await get('reports/schedules')).json()) as {
      data: { items: Array<{ total: number; completado: number }> };
    };
    assert.equal(schedules.data.items[0].total, 2);
    assert.equal(schedules.data.items[0].completado, 1);
    const csv = await get('reports/export/events?page=2&limit=1');
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type') ?? '', /text\/csv/);
    const csvBody = await csv.text();
    assert.match(csvBody, /'\=SUM\(1,1\)/);
    assert.equal(csvBody.trim().split('\r\n').length, 4);

    const profileResponse = await api.request('profiles', {
      method: 'POST',
      session: owner,
      body: {
        name: 'Reportes solo eventos',
        description: 'Acceso limitado',
        permissionKeys: ['reportes.ver', 'eventos.ver'],
      },
    });
    assert.equal(profileResponse.status, 201);
    const profile = (await profileResponse.json()) as { data: { id: string } };
    const createdUser = await api.request('users', {
      method: 'POST',
      session: owner,
      body: {
        name: 'Consulta limitada',
        email: 'reportes-limited@example.test',
        password: 'Prueba-segura1',
        profileId: profile.data.id,
      },
    });
    assert.equal(createdUser.status, 201);
    const limited = await api.login(
      'reportes-limited@example.test',
      'Prueba-segura1',
    );
    assert.equal((await get('reports/budgets', limited)).status, 403);
    assert.equal((await get('reports/export/budgets', limited)).status, 403);
    const summary = (await (await get('reports/summary', limited)).json()) as {
      data: { events: unknown; budgets: unknown; inventory: unknown };
    };
    assert.ok(summary.data.events);
    assert.equal(summary.data.budgets, null);
    assert.equal(summary.data.inventory, null);
    await api.connection
      .collection('permissions')
      .updateOne({ key: 'presupuestos.ver' }, { $set: { status: 'inactivo' } });
    assert.equal((await get('reports/budgets')).status, 403);
    const revokedSummary = (await (await get('reports/summary')).json()) as {
      data: { budgets: unknown };
    };
    assert.equal(revokedSummary.data.budgets, null);
    await api.connection
      .collection('permissions')
      .updateOne({ key: 'presupuestos.ver' }, { $set: { status: 'activo' } });
    await api.connection.collection('memberships').updateOne(
      {
        userId: new Types.ObjectId(
          (limited.data as { user: { id: string } }).user.id,
        ),
        tenantId: tenant,
      },
      { $set: { status: 'inactivo' } },
    );
    assert.equal((await get('reports/events', limited)).status, 401);
    await api.connection
      .collection('permissions')
      .updateOne({ key: 'reportes.ver' }, { $set: { status: 'inactivo' } });
    assert.equal((await get('reports/events')).status, 403);
  } finally {
    await api.close();
  }
});
