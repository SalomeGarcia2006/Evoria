import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createHttpTestApi,
  createTenantTestContext,
} from '../testing/http-test-api';
import { addRegistrationIndexesMigration } from '../migrations/20261117-add-registration-indexes.migration';
import { disableUserCreatePermissionMigration } from '../migrations/20261117-disable-user-create-permission.migration';

test('HTTP: registro empresarial, verificación y asignación de perfil', async () => {
  let message = '';
  const api = await createHttpTestApi('registration_test', undefined, {
    send: async (_to, _subject, text) => void (message = text),
  });
  try {
    const { ownerSession } = await createTenantTestContext(api);
    await addRegistrationIndexesMigration.up(api.connection);
    await addRegistrationIndexesMigration.up(api.connection);
    await api.connection
      .collection('permissions')
      .insertOne({ key: 'usuarios.crear', status: 'activo' });
    await disableUserCreatePermissionMigration.up(api.connection);
    assert.equal(
      (
        await api.connection
          .collection('permissions')
          .findOne({ key: 'usuarios.crear' })
      )?.status,
      'inactivo',
    );
    assert.equal(
      (
        await api.request('users', {
          method: 'POST',
          session: ownerSession,
          body: {},
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await api.request('tenants/context', {
          method: 'PATCH',
          session: ownerSession,
          body: { emailDomain: 'empresa.test' },
        })
      ).status,
      200,
    );
    const linkResponse = await api.request('tenants/registration-link', {
      session: ownerSession,
    });
    const token = ((await linkResponse.json()) as { data: { token: string } })
      .data.token;
    const link = await api.request(`auth/registration/${token}`);
    assert.equal(link.status, 200);
    assert.equal((await link.json()).data.emailDomain, 'empresa.test');
    const input = {
      token,
      name: 'Ana',
      lastName: 'García',
      email: 'ana@empresa.test',
      password: 'Segura-123!',
    };
    assert.equal(
      (
        await api.request('auth/registration/request', {
          method: 'POST',
          body: { ...input, email: 'ana@externo.test' },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await api.request('auth/registration/request', {
          method: 'POST',
          body: input,
        })
      ).status,
      200,
    );
    const code = message.match(/es ([A-Z0-9]{6})\./)?.[1];
    assert.ok(code);
    assert.equal(
      (
        await api.request('auth/registration/confirm', {
          method: 'POST',
          body: {
            token,
            email: input.email,
            code: 'AAAAAA' === code ? 'BBBBBB' : 'AAAAAA',
          },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await api.request('auth/registration/confirm', {
          method: 'POST',
          body: { token, email: input.email, code },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api.request('auth/registration/request', {
          method: 'POST',
          body: input,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await api.request('auth/registration/confirm', {
          method: 'POST',
          body: { token, email: input.email, code },
        })
      ).status,
      401,
    );
    const session = await api.login<{
      pendingProfile: boolean;
      permissions: string[];
    }>(input.email, input.password);
    assert.equal(session.data.pendingProfile, true);
    assert.deepEqual(session.data.permissions, []);
    assert.equal((await api.request('auth/me', { session })).status, 200);
    assert.equal(
      (await api.request('auth/google/connection', { session })).status,
      403,
    );
    assert.equal((await api.request('users', { session })).status, 403);
    const users = (await (
      await api.request('users', { session: ownerSession })
    ).json()) as {
      data: {
        items: Array<{
          id: string;
          email: string;
          profile: null;
          lastName: string;
        }>;
      };
    };
    const user = users.data.items.find((item) => item.email === input.email);
    assert.ok(user);
    assert.equal(user.profile, null);
    assert.equal(user.lastName, input.lastName);
    const profiles = (await (
      await api.request('users/profiles', { session: ownerSession })
    ).json()) as { data: Array<{ id: string; name: string }> };
    const profile = profiles.data.find((item) => item.name === 'Administrador');
    assert.ok(profile);
    assert.equal(
      (
        await api.request(`users/${user.id}`, {
          method: 'PATCH',
          session: ownerSession,
          body: { profileId: profile.id },
        })
      ).status,
      200,
    );
    assert.equal((await api.request('users', { session })).status, 200);
    assert.equal(
      (
        await api.request('tenants/context', {
          method: 'PATCH',
          session: ownerSession,
          body: { emailDomain: 'empresa-nueva.test' },
        })
      ).status,
      200,
    );
    assert.ok((await api.login(input.email, input.password)).data);
    assert.equal(
      (
        await api.request('auth/registration/request', {
          method: 'POST',
          body: { ...input, email: 'otro@empresa.test' },
        })
      ).status,
      400,
    );
    const pendingInput = { ...input, email: 'otro@empresa-nueva.test' };
    assert.equal(
      (
        await api.request('auth/registration/request', {
          method: 'POST',
          body: pendingInput,
        })
      ).status,
      200,
    );
    const pendingCode = message.match(/es ([A-Z0-9]{6})\./)?.[1];
    assert.ok(pendingCode);
    const rotated = await api.request('tenants/registration-link/rotate', {
      method: 'POST',
      session: ownerSession,
    });
    assert.equal(rotated.status, 201);
    assert.equal((await api.request(`auth/registration/${token}`)).status, 404);
    assert.equal(
      (
        await api.request('auth/registration/confirm', {
          method: 'POST',
          body: { token, email: pendingInput.email, code: pendingCode },
        })
      ).status,
      401,
    );
  } finally {
    await api.close();
  }
});

test('HTTP: registro rechaza códigos agotados, vencidos y enlaces renovados', async () => {
  let message = '';
  let failMail = true;
  const api = await createHttpTestApi('registration_failures_test', undefined, {
    send: async (_to, _subject, text) => {
      if (failMail) throw new Error('SMTP no disponible');
      message = text;
    },
  });
  try {
    const { ownerSession } = await createTenantTestContext(api);
    await api.request('tenants/context', {
      method: 'PATCH',
      session: ownerSession,
      body: { emailDomain: 'example.test' },
    });
    const token = (
      (await (
        await api.request('tenants/registration-link', {
          session: ownerSession,
        })
      ).json()) as { data: { token: string } }
    ).data.token;
    const input = {
      token,
      name: 'Carlos',
      lastName: 'Gómez',
      email: 'carlos@example.test',
      password: 'Segura-123!',
    };
    assert.equal(
      (
        await api.request('auth/registration/request', {
          method: 'POST',
          body: input,
        })
      ).status,
      503,
    );
    assert.equal(
      await api.connection
        .collection('pending_registrations')
        .countDocuments({ email: input.email }),
      0,
    );
    failMail = false;
    assert.equal(
      (
        await api.request('auth/registration/request', {
          method: 'POST',
          body: input,
        })
      ).status,
      200,
    );
    let code = message.match(/es ([A-Z0-9]{6})\./)?.[1];
    assert.ok(code);
    const wrong = code === 'AAAAAA' ? 'BBBBBB' : 'AAAAAA';
    for (let attempt = 0; attempt < 5; attempt++) {
      assert.equal(
        (
          await api.request('auth/registration/confirm', {
            method: 'POST',
            body: { token, email: input.email, code: wrong },
          })
        ).status,
        401,
      );
    }
    assert.equal(
      (
        await api.request('auth/registration/confirm', {
          method: 'POST',
          body: { token, email: input.email, code },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await api.request('auth/registration/request', {
          method: 'POST',
          body: input,
        })
      ).status,
      200,
    );
    code = message.match(/es ([A-Z0-9]{6})\./)?.[1];
    assert.ok(code);
    await api.connection
      .collection('pending_registrations')
      .updateOne({ email: input.email }, { $set: { expiresAt: new Date(0) } });
    assert.equal(
      (
        await api.request('auth/registration/confirm', {
          method: 'POST',
          body: { token, email: input.email, code },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await api.request('auth/registration/request', {
          method: 'POST',
          body: input,
        })
      ).status,
      200,
    );
    code = message.match(/es ([A-Z0-9]{6})\./)?.[1];
    assert.ok(code);
    assert.equal(
      (
        await api.request('tenants/registration-link/rotate', {
          method: 'POST',
          session: ownerSession,
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await api.request('auth/registration/confirm', {
          method: 'POST',
          body: { token, email: input.email, code },
        })
      ).status,
      401,
    );
    assert.equal(
      await api.connection
        .collection('users')
        .countDocuments({ email: input.email }),
      0,
    );
  } finally {
    await api.close();
  }
});
