import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createHttpTestApi,
  createTenantTestContext,
} from '../testing/http-test-api';

test('HTTP: tipos aislados por empresa y acceso para crear o editar', async () => {
  const api = await createHttpTestApi('event_types_test');
  try {
    const { ownerSession, developerSession } =
      await createTenantTestContext(api);
    assert.equal(
      (await api.request('events/types', { session: developerSession })).status,
      403,
    );
    assert.equal(
      (
        await api.request('tenants/context', {
          method: 'PATCH',
          session: ownerSession,
          body: { eventTypes: ['Boda'] },
        })
      ).status,
      200,
    );
    const second = await api.request('tenants', {
      method: 'POST',
      session: developerSession,
      body: {
        name: 'Segunda empresa',
        nit: '900987654-3',
        ownerName: 'Otro administrador',
        ownerEmail: 'other@example.test',
        ownerPassword: 'Prueba-segura1',
      },
    });
    assert.equal(second.status, 201);
    const otherSession = await api.login(
      'other@example.test',
      'Prueba-segura1',
    );
    assert.equal(
      (
        await api.request('tenants/context', {
          method: 'PATCH',
          session: otherSession,
          body: { eventTypes: ['Concierto'] },
        })
      ).status,
      200,
    );
    for (const [session, expected] of [
      [ownerSession, 'Boda'],
      [otherSession, 'Concierto'],
    ] as const) {
      const response = await api.request('events/types', { session });
      assert.equal(response.status, 200);
      assert.deepEqual(
        ((await response.json()) as { data: { types: string[] } }).data.types,
        [expected],
      );
    }
    const rejected = await api.request('events', {
      method: 'POST',
      session: otherSession,
      body: {
        name: 'Evento ajeno',
        type: 'Boda',
        startAt: '2030-01-10T10:00:00.000Z',
        endAt: '2030-01-10T18:00:00.000Z',
        baseBudget: 100000,
      },
    });
    assert.equal(rejected.status, 400);
    for (const [permission, name] of [
      ['eventos.crear', 'creador'],
      ['eventos.editar', 'editor'],
    ] as const) {
      const profileResponse = await api.request('profiles', {
        method: 'POST',
        session: ownerSession,
        body: {
          name,
          description: 'Perfil de prueba',
          permissionKeys: [permission],
        },
      });
      assert.equal(profileResponse.status, 201);
      const profile = (await profileResponse.json()) as {
        data: { id: string };
      };
      const email = `${name}@example.test`;
      assert.equal(
        (
          await api.createUserFixture({
            method: 'POST',
            session: ownerSession,
            body: {
              name,
              email,
              password: 'Prueba-segura1',
              profileId: profile.data.id,
            },
          })
        ).status,
        201,
      );
      const session = await api.login(email, 'Prueba-segura1');
      assert.equal(
        (await api.request('events/types', { session })).status,
        200,
      );
    }
  } finally {
    await api.close();
  }
});

test('HTTP: operaciones de eventos, recursos y proveedores conservan sus datos', async () => {
  const api = await createHttpTestApi('operations_test');
  try {
    const { ownerSession } = await createTenantTestContext(api);
    const defaults = await api.request('events/types', {
      session: ownerSession,
    });
    assert.equal(defaults.status, 200);
    assert.equal(
      ((await defaults.json()) as { data: { source: string } }).data.source,
      'default',
    );
    assert.equal((await api.request('events/types')).status, 401);
    assert.equal(
      (
        await api.request('tenants/context', {
          method: 'PATCH',
          session: ownerSession,
          body: { eventTypes: ['Corporativo', ' corporativo ', '  '] },
        })
      ).status,
      200,
    );
    const typesResponse = await api.request('events/types', {
      session: ownerSession,
    });
    assert.equal(typesResponse.status, 200);
    assert.deepEqual(
      ((await typesResponse.json()) as { data: { types: string[] } }).data
        .types,
      ['Corporativo'],
    );
    assert.equal(
      (
        await api.request('events', {
          method: 'POST',
          session: ownerSession,
          body: {
            name: 'Tipo inválido',
            startAt: '2030-01-10T10:00:00.000Z',
            endAt: '2030-01-10T18:00:00.000Z',
            type: 'Boda',
            baseBudget: 100000,
          },
        })
      ).status,
      400,
    );
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
      (
        await api.request('tenants/context', {
          method: 'PATCH',
          session: ownerSession,
          body: { eventTypes: ['Feria'] },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api.request(`events/${event.data.id}`, {
          method: 'PATCH',
          session: ownerSession,
          body: { type: 'Corporativo' },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api.request(`events/${event.data.id}`, {
          method: 'PATCH',
          session: ownerSession,
          body: { type: 'Boda' },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await api.request(`events/${event.data.id}`, {
          method: 'PATCH',
          session: ownerSession,
          body: { type: ' feria ' },
        })
      ).status,
      200,
    );
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
      409,
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
