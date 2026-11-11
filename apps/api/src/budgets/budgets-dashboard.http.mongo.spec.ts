import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import {
  createHttpTestApi,
  createTenantTestContext,
  type HttpSession,
} from '../testing/http-test-api';

interface SessionData {
  user: { id: string };
}

test('HTTP: presupuestos, alertas, auditoría y métricas usan la sesión autorizada', async () => {
  const api = await createHttpTestApi('budgets_dashboard_test');
  try {
    const context = await createTenantTestContext(api);
    const ownerSession = context.ownerSession as HttpSession<SessionData>;

    const profileResponse = await api.request('profiles', {
      method: 'POST',
      session: ownerSession,
      body: {
        name: 'Solicitante de presupuesto',
        description: 'Solicita cambios de presupuesto.',
        permissionKeys: ['presupuestos.editar'],
      },
    });
    assert.equal(profileResponse.status, 201);
    const profile = (await profileResponse.json()) as { data: { id: string } };
    const requesterResponse = await api.request('users', {
      method: 'POST',
      session: ownerSession,
      body: {
        name: 'Solicitante de prueba',
        email: 'requester@example.test',
        password: 'prueba-segura',
        profileId: profile.data.id,
      },
    });
    assert.equal(requesterResponse.status, 201);
    const requesterSession = await api.login(
      'requester@example.test',
      'prueba-segura',
    );

    const eventResponse = await api.request('events', {
      method: 'POST',
      session: ownerSession,
      body: {
        name: 'Evento con presupuesto',
        startAt: '2030-03-10T10:00:00.000Z',
        endAt: '2030-03-10T18:00:00.000Z',
        baseBudget: 100000,
        responsibleUserId: ownerSession.data.user.id,
      },
    });
    assert.equal(eventResponse.status, 201);
    const event = (await eventResponse.json()) as { data: { id: string } };

    assert.equal(
      (await api.request('budgets', { session: ownerSession })).status,
      200,
    );
    assert.equal(
      (
        await api.request(`events/${event.data.id}/budget`, {
          session: ownerSession,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api.request(`events/${event.data.id}/budget`, {
          method: 'POST',
          session: ownerSession,
          body: { baseAmountCop: 100000 },
        })
      ).status,
      409,
    );

    const manualEventId = new Types.ObjectId();
    const now = new Date();
    await api.connection.collection('events').insertOne({
      _id: manualEventId,
      tenantId: new Types.ObjectId(context.tenantId),
      name: 'Evento sin presupuesto',
      startAt: now,
      endAt: new Date(now.getTime() + 3_600_000),
      baseBudget: 0,
      status: 'borrador',
      responsibleUserId: null,
      responsibleAssignedAt: null,
      budgetDecisionRevision: 0,
      createdBy: new Types.ObjectId(ownerSession.data.user.id),
      createdAt: now,
      updatedAt: now,
    });
    assert.equal(
      (
        await api.request(`events/${manualEventId}/budget`, {
          method: 'POST',
          session: ownerSession,
          body: { baseAmountCop: 50000 },
        })
      ).status,
      201,
    );

    const requestResponse = await api.request(
      `events/${event.data.id}/budget/requests`,
      {
        method: 'POST',
        session: requesterSession,
        body: {
          type: 'ampliacion',
          amountCop: 20000,
          reason: 'El proveedor requiere un ajuste adicional.',
        },
      },
    );
    assert.equal(requestResponse.status, 201);
    const request = (await requestResponse.json()) as { data: { id: string } };
    assert.equal(
      (
        await api.request('budgets/authorizations', {
          session: requesterSession,
        })
      ).status,
      403,
    );
    assert.equal(
      (await api.request('budgets/authorizations', { session: ownerSession }))
        .status,
      200,
    );
    assert.equal(
      (
        await api.request(
          `events/${event.data.id}/budget/requests/${request.data.id}/approve`,
          { method: 'POST', session: ownerSession },
        )
      ).status,
      201,
    );

    const rejectedRequestResponse = await api.request(
      `events/${event.data.id}/budget/requests`,
      {
        method: 'POST',
        session: requesterSession,
        body: {
          type: 'costo_adicional',
          amountCop: 10000,
          reason: 'El cliente decidió reducir un servicio.',
        },
      },
    );
    assert.equal(rejectedRequestResponse.status, 201);
    const rejectedRequest = (await rejectedRequestResponse.json()) as {
      data: { id: string };
    };
    assert.equal(
      (
        await api.request(
          `events/${event.data.id}/budget/requests/${rejectedRequest.data.id}/reject`,
          {
            method: 'POST',
            session: ownerSession,
            body: { reason: 'La reducción no es viable para este evento.' },
          },
        )
      ).status,
      201,
    );

    const alerts = await api.request('alerts', { session: ownerSession });
    assert.equal(alerts.status, 200);
    const alertsBody = (await alerts.json()) as {
      data: { items: Array<{ id: string }> };
    };
    assert.ok(alertsBody.data.items.length > 0);
    const alertId = alertsBody.data.items[0].id;
    assert.equal(
      (await api.request('alerts/unread-count', { session: ownerSession }))
        .status,
      200,
    );
    assert.equal(
      (await api.request(`alerts/${alertId}`, { session: ownerSession }))
        .status,
      200,
    );
    assert.equal(
      (
        await api.request(`alerts/${alertId}/read`, {
          method: 'PATCH',
          session: ownerSession,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api.request('alerts/read-all', {
          method: 'PATCH',
          session: ownerSession,
        })
      ).status,
      200,
    );

    assert.equal(
      (
        await api.request('audit-logs?module=presupuestos', {
          session: ownerSession,
        })
      ).status,
      200,
    );
    assert.equal(
      (await api.request('dashboard/summary', { session: ownerSession }))
        .status,
      200,
    );
  } finally {
    await api.close();
  }
});
