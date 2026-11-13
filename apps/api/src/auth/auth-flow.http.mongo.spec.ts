import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHttpTestApi } from '../testing/http-test-api';

interface SessionData {
  isDeveloper: boolean;
  permissions: string[];
  scope: 'platform' | 'tenant';
  tenant?: { id: string };
}

test('HTTP: sesión, empresa, perfiles y permisos se aplican al iniciar sesión', async () => {
  const api = await createHttpTestApi('auth_flow_test');
  try {
    await api.seedAccessControl();
    const developer = await api.seedDeveloper();

    assert.equal((await api.request('events')).status, 401);
    assert.equal(
      (
        await api.request('auth/login', {
          method: 'POST',
          body: { email: developer.email, password: 'incorrecta' },
        })
      ).status,
      401,
    );

    const developerSession = await api.login<SessionData>(
      developer.email,
      developer.password,
    );
    assert.equal(developerSession.data.scope, 'platform');
    assert.equal(developerSession.data.isDeveloper, true);

    const tenantResponse = await api.request('tenants', {
      method: 'POST',
      session: developerSession,
      body: {
        name: 'Empresa de permisos',
        nit: '900123456-7',
        ownerName: 'Administradora de prueba',
        ownerEmail: 'owner@example.test',
        ownerPassword: 'Prueba-segura1',
      },
    });
    assert.equal(tenantResponse.status, 201);
    const tenant = (await tenantResponse.json()) as { data: { id: string } };

    const ownerSession = await api.login<SessionData>(
      'owner@example.test',
      'Prueba-segura1',
    );
    assert.equal(ownerSession.data.scope, 'tenant');
    assert.equal(ownerSession.data.tenant?.id, tenant.data.id);
    assert.ok(ownerSession.data.permissions.includes('perfiles.crear'));

    const invalidProfile = await api.request('profiles', {
      method: 'POST',
      session: ownerSession,
      body: { name: 'x', description: 'x', permissionKeys: [] },
    });
    assert.equal(invalidProfile.status, 400);

    const profileResponse = await api.request('profiles', {
      method: 'POST',
      session: ownerSession,
      body: {
        name: 'Solo consulta de eventos',
        description: 'Puede consultar los eventos de su empresa.',
        permissionKeys: ['eventos.ver'],
      },
    });
    assert.equal(profileResponse.status, 201);
    const profile = (await profileResponse.json()) as { data: { id: string } };

    const userResponse = await api.request('users', {
      method: 'POST',
      session: ownerSession,
      body: {
        name: 'Usuario restringido',
        email: 'restricted@example.test',
        password: 'Prueba-segura1',
        profileId: profile.data.id,
      },
    });
    assert.equal(userResponse.status, 201);

    const restrictedSession = await api.login<SessionData>(
      'restricted@example.test',
      'Prueba-segura1',
    );
    assert.equal(restrictedSession.data.scope, 'tenant');
    assert.deepEqual(restrictedSession.data.permissions, ['eventos.ver']);
    assert.equal(
      (await api.request('events', { session: restrictedSession })).status,
      200,
    );
    assert.equal(
      (
        await api.request('events', {
          method: 'POST',
          session: restrictedSession,
          body: {
            name: 'No autorizado',
            startAt: '2030-01-10T10:00:00.000Z',
            endAt: '2030-01-10T18:00:00.000Z',
            baseBudget: 500000,
          },
        })
      ).status,
      403,
    );
    assert.equal(
      (await api.request('users', { session: restrictedSession })).status,
      403,
    );

    const refreshed = await api.request('auth/refresh', {
      method: 'POST',
      session: restrictedSession,
    });
    assert.equal(refreshed.status, 200);
    assert.equal(
      (await api.request('auth/me', { session: restrictedSession })).status,
      200,
    );
    assert.equal(
      (
        await api.request('auth/logout', {
          method: 'POST',
          session: restrictedSession,
        })
      ).status,
      200,
    );
    assert.equal(
      (await api.request('auth/me', { session: restrictedSession })).status,
      401,
    );
  } finally {
    await api.close();
  }
});
