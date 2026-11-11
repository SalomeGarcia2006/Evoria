import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createHttpTestApi,
  createTenantTestContext,
  type HttpSession,
} from '../testing/http-test-api';

function stateFrom(response: { data: { url: string } }): string {
  const state = new URL(response.data.url).searchParams.get('state');
  assert.ok(state);
  return state;
}

test('HTTP: Google solo inicia sesión después de vincularse y respeta la empresa', async () => {
  const api = await createHttpTestApi('google_oauth_test', {
    async authorization(state, nonce) {
      return {
        codeVerifier: 'verificador-de-prueba',
        url: `https://accounts.google.test/authorize?state=${state}&nonce=${nonce}`,
      };
    },
    async exchange(code) {
      return {
        subject: code === 'otra' ? 'google-otra' : 'google-owner',
        email: code === 'otra' ? 'otra@google.test' : 'owner@google.test',
      };
    },
  });
  try {
    const { developerSession, ownerSession, tenantId } =
      await createTenantTestContext(api);

    assert.equal((await api.request('auth/google/connection')).status, 401);
    assert.equal(
      (await api.request('auth/google/link', { method: 'POST' })).status,
      401,
    );
    const initialConnection = await api.request('auth/google/connection', {
      session: ownerSession,
    });
    assert.equal(initialConnection.status, 200);
    assert.equal((await initialConnection.json()).data.linked, false);

    const unknownStart = await api.request('auth/google/login', {
      method: 'POST',
      body: {},
    });
    assert.equal(unknownStart.status, 200);
    const unknownState = stateFrom(await unknownStart.json());
    const unknownSession: HttpSession = {
      cookies: unknownStart.headers.getSetCookie()[0].split(';', 1)[0],
      data: null,
    };
    const unknownCallback = await api.request(
      `auth/google/callback?state=${unknownState}&code=otra`,
      { session: unknownSession, redirect: 'manual' },
    );
    assert.equal(unknownCallback.status, 302);
    assert.match(
      unknownCallback.headers.get('location') ?? '',
      /google=unlinked/,
    );
    assert.equal(
      (await api.request('auth/me', { session: unknownSession })).status,
      401,
    );

    const linkStart = await api.request('auth/google/link', {
      method: 'POST',
      session: ownerSession,
    });
    assert.equal(linkStart.status, 200);
    stateFrom(await linkStart.json());
    const tamperedCallback = await api.request(
      `auth/google/callback?state=incorrecto&code=owner`,
      { session: ownerSession, redirect: 'manual' },
    );
    assert.equal(tamperedCallback.status, 302);
    assert.match(
      tamperedCallback.headers.get('location') ?? '',
      /google=error/,
    );
    assert.equal(
      (
        await api
          .request('auth/google/connection', { session: ownerSession })
          .then((response) => response.json())
      ).data.linked,
      false,
    );

    const validLinkStart = await api.request('auth/google/link', {
      method: 'POST',
      session: ownerSession,
    });
    assert.equal(validLinkStart.status, 200);
    const validLinkState = stateFrom(await validLinkStart.json());
    const linkCallback = await api.request(
      `auth/google/callback?state=${validLinkState}&code=owner`,
      { session: ownerSession, redirect: 'manual' },
    );
    assert.equal(linkCallback.status, 302);
    assert.match(linkCallback.headers.get('location') ?? '', /google=linked/);
    const connection = await api.request('auth/google/connection', {
      session: ownerSession,
    });
    assert.equal((await connection.json()).data.email, 'owner@google.test');

    const otherLink = await api.request('auth/google/link', {
      method: 'POST',
      session: developerSession,
    });
    const otherState = stateFrom(await otherLink.json());
    const otherCallback = await api.request(
      `auth/google/callback?state=${otherState}&code=owner`,
      { session: developerSession, redirect: 'manual' },
    );
    assert.match(
      otherCallback.headers.get('location') ?? '',
      /google=already-used/,
    );

    const loginStart = await api.request('auth/google/login', {
      method: 'POST',
      body: {},
    });
    assert.equal(loginStart.status, 200);
    const loginState = stateFrom(await loginStart.json());
    const googleSession: HttpSession = {
      cookies: loginStart.headers.getSetCookie()[0].split(';', 1)[0],
      data: null,
    };
    const loginCallback = await api.request(
      `auth/google/callback?state=${loginState}&code=owner`,
      { session: googleSession, redirect: 'manual' },
    );
    assert.equal(loginCallback.status, 302);
    assert.match(
      loginCallback.headers.get('location') ?? '',
      /google=signed-in/,
    );
    const session = await api.request('auth/me', { session: googleSession });
    assert.equal(session.status, 200);
    const sessionBody = (await session.json()) as {
      data: { scope: string; tenant?: { id: string }; permissions: string[] };
    };
    assert.equal(sessionBody.data.scope, 'tenant');
    assert.equal(sessionBody.data.tenant?.id, tenantId);
    assert.ok(sessionBody.data.permissions.includes('perfiles.crear'));

    const replay = await api.request(
      `auth/google/callback?state=${loginState}&code=owner`,
      { session: googleSession, redirect: 'manual' },
    );
    assert.match(replay.headers.get('location') ?? '', /google=error/);
  } finally {
    await api.close();
  }
});
