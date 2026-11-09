import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHttpTestApi } from '../testing/http-test-api';

const protectedRoutes = [
  ['GET', 'auth/me'],
  ['GET', 'tenants'],
  ['POST', 'tenants'],
  ['POST', 'tenants/000000000000000000000000/join'],
  ['POST', 'tenants/leave'],
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
