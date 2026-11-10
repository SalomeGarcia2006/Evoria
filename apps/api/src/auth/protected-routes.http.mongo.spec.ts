import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createHttpTestApi,
  createTenantTestContext,
} from '../testing/http-test-api';

const protectedRoutes = [
  ['GET', 'auth/me'],
  ['GET', 'auth/google/connection'],
  ['POST', 'auth/google/link'],
  ['GET', 'tenants'],
  ['POST', 'tenants'],
  ['POST', 'tenants/000000000000000000000000/join'],
  ['POST', 'tenants/leave'],
  ['DELETE', 'tenants/000000000000000000000000'],
  ['GET', 'tenants/context'],
  ['PATCH', 'tenants/context'],
  ['GET', 'permissions'],
  ['POST', 'profiles'],
  ['GET', 'profiles'],
  ['GET', 'profiles/000000000000000000000000'],
  ['PATCH', 'profiles/000000000000000000000000'],
  ['DELETE', 'profiles/000000000000000000000000'],
  ['POST', 'users'],
  ['GET', 'users'],
  ['GET', 'users/profiles'],
  ['GET', 'users/000000000000000000000000'],
  ['PATCH', 'users/000000000000000000000000'],
  ['DELETE', 'users/000000000000000000000000'],
  ['POST', 'events'],
  ['GET', 'events'],
  ['GET', 'events/000000000000000000000000'],
  ['PATCH', 'events/000000000000000000000000'],
  ['DELETE', 'events/000000000000000000000000'],
  ['POST', 'events/000000000000000000000000/schedules'],
  ['GET', 'events/000000000000000000000000/schedules'],
  ['PATCH', 'schedules/000000000000000000000000'],
  ['DELETE', 'schedules/000000000000000000000000'],
  ['POST', 'inventory'],
  ['GET', 'inventory'],
  ['GET', 'inventory/000000000000000000000000'],
  ['PATCH', 'inventory/000000000000000000000000'],
  ['DELETE', 'inventory/000000000000000000000000'],
  ['GET', 'events/000000000000000000000000/resources'],
  ['POST', 'events/000000000000000000000000/resources'],
  [
    'DELETE',
    'events/000000000000000000000000/resources/000000000000000000000000',
  ],
  ['GET', 'providers'],
  ['POST', 'providers'],
  ['GET', 'providers/000000000000000000000000'],
  ['PATCH', 'providers/000000000000000000000000'],
  ['DELETE', 'providers/000000000000000000000000'],
  ['GET', 'events/000000000000000000000000/provider-services'],
  ['POST', 'events/000000000000000000000000/provider-services'],
  [
    'PATCH',
    'events/000000000000000000000000/provider-services/000000000000000000000000',
  ],
  [
    'DELETE',
    'events/000000000000000000000000/provider-services/000000000000000000000000',
  ],
  ['GET', 'budgets'],
  ['GET', 'budgets/authorizations'],
  ['GET', 'events/000000000000000000000000/budget'],
  ['POST', 'events/000000000000000000000000/budget'],
  ['POST', 'events/000000000000000000000000/budget/requests'],
  [
    'POST',
    'events/000000000000000000000000/budget/requests/000000000000000000000000/approve',
  ],
  [
    'POST',
    'events/000000000000000000000000/budget/requests/000000000000000000000000/reject',
  ],
  ['GET', 'alerts'],
  ['GET', 'alerts/unread-count'],
  ['PATCH', 'alerts/read-all'],
  ['GET', 'alerts/000000000000000000000000'],
  ['PATCH', 'alerts/000000000000000000000000/read'],
  ['GET', 'audit-logs'],
  ['GET', 'dashboard/summary'],
] as const;

test('HTTP: toda ruta protegida rechaza solicitudes sin sesión', async () => {
  const api = await createHttpTestApi('protected_routes_test');
  try {
    for (const [method, path] of protectedRoutes) {
      const response = await api.request(path, { method });
      assert.equal(response.status, 401, `${method} /${path}`);
    }
  } finally {
    await api.close();
  }
});

test('HTTP: una sesión solo accede a las rutas de sus permisos', async () => {
  const api = await createHttpTestApi('permission_routes_test');
  try {
    const { ownerSession } = await createTenantTestContext(api);
    const eventResponse = await api.request('events', {
      method: 'POST',
      session: ownerSession,
      body: {
        name: 'Evento visible',
        startAt: '2030-01-10T10:00:00.000Z',
        endAt: '2030-01-10T18:00:00.000Z',
        baseBudget: 100000,
      },
    });
    assert.equal(eventResponse.status, 201);
    const event = (await eventResponse.json()) as { data: { id: string } };
    const profileResponse = await api.request('profiles', {
      method: 'POST',
      session: ownerSession,
      body: {
        name: 'Solo lectura de eventos',
        description: 'Consulta únicamente eventos.',
        permissionKeys: ['eventos.ver'],
      },
    });
    assert.equal(profileResponse.status, 201);
    const profile = (await profileResponse.json()) as { data: { id: string } };
    const userResponse = await api.request('users', {
      method: 'POST',
      session: ownerSession,
      body: {
        name: 'Lector de prueba',
        email: 'reader@example.test',
        password: 'prueba-segura',
        profileId: profile.data.id,
      },
    });
    assert.equal(userResponse.status, 201);
    const reader = await api.login('reader@example.test', 'prueba-segura');

    for (const [method, path] of protectedRoutes) {
      const actualPath =
        path === 'events/000000000000000000000000'
          ? `events/${event.data.id}`
          : path;
      const expectedStatus =
        actualPath === 'auth/me' ||
        actualPath === 'auth/google/connection' ||
        (method === 'GET' &&
          (actualPath === 'events' || actualPath === `events/${event.data.id}`))
          ? 200
          : 403;
      const response = await api.request(actualPath, {
        method,
        session: reader,
      });
      if (actualPath === 'auth/google/link') {
        assert.notEqual(response.status, 403, `${method} /${actualPath}`);
        continue;
      }
      assert.equal(response.status, expectedStatus, `${method} /${actualPath}`);
    }
  } finally {
    await api.close();
  }
});
