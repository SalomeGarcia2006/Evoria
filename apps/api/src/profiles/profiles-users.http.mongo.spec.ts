import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createHttpTestApi,
  createTenantTestContext,
} from '../testing/http-test-api';

test('HTTP: perfiles, permisos y usuarios se administran dentro de la empresa', async () => {
  const api = await createHttpTestApi('profiles_users_test');
  try {
    const { ownerSession } = await createTenantTestContext(api);

    const permissions = await api.request('permissions', {
      session: ownerSession,
    });
    assert.equal(permissions.status, 200);
    const permissionModules = (await permissions.json()) as {
      data: Array<{ key: string; permissions: Array<{ key: string }> }>;
    };
    assert.ok(
      permissionModules.data.some((module) =>
        module.permissions.some(
          (permission) => permission.key === 'usuarios.ver',
        ),
      ),
    );

    const invalidProfile = await api.request('profiles', {
      method: 'POST',
      session: ownerSession,
      body: {
        name: 'Perfil inválido',
        description: 'Incluye un permiso que no existe.',
        permissionKeys: ['inexistente.ver'],
      },
    });
    assert.equal(invalidProfile.status, 400);

    const profileResponse = await api.request('profiles', {
      method: 'POST',
      session: ownerSession,
      body: {
        name: 'Operador de eventos',
        description: 'Gestiona los eventos asignados.',
        permissionKeys: ['eventos.ver', 'eventos.crear'],
      },
    });
    assert.equal(profileResponse.status, 201);
    const profile = (await profileResponse.json()) as { data: { id: string } };

    assert.equal(
      (await api.request('profiles', { session: ownerSession })).status,
      200,
    );
    assert.equal(
      (
        await api.request(`profiles/${profile.data.id}`, {
          session: ownerSession,
        })
      ).status,
      200,
    );
    const updatedProfile = await api.request(`profiles/${profile.data.id}`, {
      method: 'PATCH',
      session: ownerSession,
      body: {
        description: 'Gestiona y consulta los eventos asignados.',
        permissionKeys: ['eventos.ver', 'eventos.crear', 'eventos.editar'],
      },
    });
    assert.equal(updatedProfile.status, 200);

    const availableProfiles = await api.request('users/profiles', {
      session: ownerSession,
    });
    assert.equal(availableProfiles.status, 200);
    const availableProfilesBody = (await availableProfiles.json()) as {
      data: Array<{ id: string }>;
    };
    assert.ok(
      availableProfilesBody.data.some(({ id }) => id === profile.data.id),
    );

    const userResponse = await api.request('users', {
      method: 'POST',
      session: ownerSession,
      body: {
        name: 'Operador de prueba',
        email: 'operator@example.test',
        password: 'prueba-segura',
        profileId: profile.data.id,
      },
    });
    assert.equal(userResponse.status, 201);
    const user = (await userResponse.json()) as { data: { id: string } };

    assert.equal(
      (await api.request('users', { session: ownerSession })).status,
      200,
    );
    assert.equal(
      (await api.request(`users/${user.data.id}`, { session: ownerSession }))
        .status,
      200,
    );
    assert.equal(
      (
        await api.request(`users/${user.data.id}`, {
          method: 'PATCH',
          session: ownerSession,
          body: { status: 'inactivo' },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api.request(`users/${user.data.id}`, {
          method: 'DELETE',
          session: ownerSession,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api.request(`profiles/${profile.data.id}`, {
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
