import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createHttpTestApi,
  createTenantTestContext,
} from '../testing/http-test-api';

test('HTTP: operaciones de eventos, recursos y proveedores conservan sus datos', async () => {
  const api = await createHttpTestApi('operations_test');
  try {
    const { ownerSession } = await createTenantTestContext(api);
    const invalidEvent = await api.request('events', {
      method: 'POST',
      session: ownerSession,
      body: {
        name: 'Evento inválido',
        startAt: '2030-01-11T18:00:00.000Z',
        endAt: '2030-01-10T10:00:00.000Z',
        baseBudget: 100000,
      },
    });
    assert.equal(invalidEvent.status, 400);

    const eventResponse = await api.request('events', {
      method: 'POST',
      session: ownerSession,
      body: {
        name: 'Evento operativo',
        description: 'Evento para probar operaciones relacionadas.',
        startAt: '2030-01-10T10:00:00.000Z',
        endAt: '2030-01-10T18:00:00.000Z',
        location: 'Bogotá',
        type: 'Corporativo',
        baseBudget: 1000000,
      },
    });
    assert.equal(eventResponse.status, 201);
    const event = (await eventResponse.json()) as { data: { id: string } };
    assert.equal(
      (await api.request('events', { session: ownerSession })).status,
      200,
    );
    assert.equal(
      (await api.request(`events/${event.data.id}`, { session: ownerSession }))
        .status,
      200,
    );
    assert.equal(
      (
        await api.request(`events/${event.data.id}`, {
          method: 'PATCH',
          session: ownerSession,
          body: { description: 'Evento actualizado para operaciones.' },
        })
      ).status,
      200,
    );

    const scheduleResponse = await api.request(
      `events/${event.data.id}/schedules`,
      {
        method: 'POST',
        session: ownerSession,
        body: {
          name: 'Montaje',
          startAt: '2030-01-10T10:00:00.000Z',
          endAt: '2030-01-10T12:00:00.000Z',
        },
      },
    );
    assert.equal(scheduleResponse.status, 201);
    const schedule = (await scheduleResponse.json()) as {
      data: { id: string };
    };
    assert.equal(
      (
        await api.request(`events/${event.data.id}/schedules`, {
          session: ownerSession,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api.request(`schedules/${schedule.data.id}`, {
          method: 'PATCH',
          session: ownerSession,
          body: { name: 'Montaje técnico' },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api.request(`schedules/${schedule.data.id}`, {
          method: 'DELETE',
          session: ownerSession,
        })
      ).status,
      200,
    );

    const inventoryResponse = await api.request('inventory', {
      method: 'POST',
      session: ownerSession,
      body: {
        name: 'Sillas',
        type: 'Mobiliario',
        unitCost: 50000,
        totalQuantity: 20,
      },
    });
    assert.equal(inventoryResponse.status, 201);
    const inventory = (await inventoryResponse.json()) as {
      data: { id: string };
    };
    assert.equal(
      (await api.request('inventory', { session: ownerSession })).status,
      200,
    );
    assert.equal(
      (
        await api.request(`inventory/${inventory.data.id}`, {
          session: ownerSession,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api.request(`inventory/${inventory.data.id}`, {
          method: 'PATCH',
          session: ownerSession,
          body: { totalQuantity: 25 },
        })
      ).status,
      200,
    );

    const assignmentResponse = await api.request(
      `events/${event.data.id}/resources`,
      {
        method: 'POST',
        session: ownerSession,
        body: { inventoryItemId: inventory.data.id, quantity: 5 },
      },
    );
    assert.equal(assignmentResponse.status, 201);
    assert.equal(
      (
        await api.request(`events/${event.data.id}/resources`, {
          session: ownerSession,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api.request(
          `events/${event.data.id}/resources/${inventory.data.id}`,
          { method: 'DELETE', session: ownerSession },
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await api.request(`inventory/${inventory.data.id}`, {
          method: 'DELETE',
          session: ownerSession,
        })
      ).status,
      200,
    );

    const providerResponse = await api.request('providers', {
      method: 'POST',
      session: ownerSession,
      body: {
        name: 'Proveedor de sonido',
        categoryKeys: ['audiovisual'],
        email: 'sound@example.test',
      },
    });
    assert.equal(providerResponse.status, 201);
    const provider = (await providerResponse.json()) as {
      data: { id: string };
    };
    assert.equal(
      (await api.request('providers', { session: ownerSession })).status,
      200,
    );
    assert.equal(
      (
        await api.request(`providers/${provider.data.id}`, {
          session: ownerSession,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api.request(`providers/${provider.data.id}`, {
          method: 'PATCH',
          session: ownerSession,
          body: { contactName: 'Andrea Proveedora' },
        })
      ).status,
      200,
    );

    const providerServiceResponse = await api.request(
      `events/${event.data.id}/provider-services`,
      {
        method: 'POST',
        session: ownerSession,
        body: {
          providerId: provider.data.id,
          serviceName: 'Sonido principal',
          startDate: '2030-01-10',
          agreedAmountCop: 200000,
        },
      },
    );
    assert.equal(providerServiceResponse.status, 201);
    const providerService = (await providerServiceResponse.json()) as {
      data: { id: string };
    };
    assert.equal(
      (
        await api.request(`events/${event.data.id}/provider-services`, {
          session: ownerSession,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api.request(
          `events/${event.data.id}/provider-services/${providerService.data.id}`,
          {
            method: 'PATCH',
            session: ownerSession,
            body: { agreedAmountCop: 250000 },
          },
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await api.request(
          `events/${event.data.id}/provider-services/${providerService.data.id}`,
          { method: 'DELETE', session: ownerSession },
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await api.request(`providers/${provider.data.id}`, {
          method: 'DELETE',
          session: ownerSession,
        })
      ).status,
      200,
    );

    const cancelledEvent = await api.request('events', {
      method: 'POST',
      session: ownerSession,
      body: {
        name: 'Evento a cancelar',
        startAt: '2030-02-10T10:00:00.000Z',
        endAt: '2030-02-10T18:00:00.000Z',
        baseBudget: 100000,
      },
    });
    assert.equal(cancelledEvent.status, 201);
    const cancelled = (await cancelledEvent.json()) as { data: { id: string } };
    assert.equal(
      (
        await api.request(`events/${cancelled.data.id}`, {
          method: 'DELETE',
          session: ownerSession,
        })
      ).status,
      200,
    );
  } finally {
    await api.close();
  }
});
