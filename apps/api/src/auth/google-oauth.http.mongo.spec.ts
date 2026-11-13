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

test('HTTP: cambiar Google exige código de un solo uso y sustituye la identidad', async () => {
  const sent: { to: string; text: string; html?: string }[] = [];
  const api = await createHttpTestApi(
    'google_change_test',
    {
      async authorization(state) {
        return {
          codeVerifier: 'verificador-de-prueba',
          url: `https://accounts.google.test/authorize?state=${state}`,
        };
      },
      async exchange(code) {
        return { subject: `google-${code}`, email: `${code}@google.test` };
      },
    },
    {
      async send(to, _subject, text, html) {
        sent.push({ to, text, html });
      },
    },
  );
  try {
    const { developerSession, ownerSession } =
      await createTenantTestContext(api);
    assert.equal(
      (await api.request('auth/google/change/request', { method: 'POST' }))
        .status,
      401,
    );
    assert.equal(
      (
        await api.request('auth/google/change/request', {
          method: 'POST',
          session: ownerSession,
        })
      ).status,
      404,
    );

    const link = await api.request('auth/google/link', {
      method: 'POST',
      session: ownerSession,
    });
    const linkState = stateFrom(await link.json());
    assert.match(
      (
        await api.request(`auth/google/callback?state=${linkState}&code=old`, {
          session: ownerSession,
          redirect: 'manual',
        })
      ).headers.get('location') ?? '',
      /google=linked/,
    );

    const requested = await api.request('auth/google/change/request', {
      method: 'POST',
      session: ownerSession,
    });
    assert.equal(requested.status, 200);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'old@google.test');
    const code = /es ([A-Z0-9]{6})\./.exec(sent[0].text)?.[1];
    assert.ok(code);
    assert.match(code, /[A-Z]/);
    assert.match(code, /[0-9]/);
    assert.match(sent[0].html ?? '', new RegExp(code));
    assert.equal(
      (
        await api.request('auth/google/change/request', {
          method: 'POST',
          session: ownerSession,
        })
      ).status,
      429,
    );
    assert.equal(
      (
        await api.request('auth/google/change/confirm', {
          method: 'POST',
          body: { code },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await api.request('auth/google/change/confirm', {
          method: 'POST',
          session: ownerSession,
          body: { code: 'INVALID' },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await api.request('auth/google/change/confirm', {
          method: 'POST',
          session: ownerSession,
          body: { code: 'ZZZZZZ' },
        })
      ).status,
      401,
    );
    const confirmed = await api.request('auth/google/change/confirm', {
      method: 'POST',
      session: ownerSession,
      body: { code: code.toLowerCase() },
    });
    assert.equal(confirmed.status, 200);
    const changeState = stateFrom(await confirmed.json());
    assert.equal(
      (
        await api.request('auth/google/change/confirm', {
          method: 'POST',
          session: ownerSession,
          body: { code },
        })
      ).status,
      401,
    );
    const changed = await api.request(
      `auth/google/callback?state=${changeState}&code=new`,
      { session: ownerSession, redirect: 'manual' },
    );
    assert.match(changed.headers.get('location') ?? '', /google=changed/);
    const connection = await api.request('auth/google/connection', {
      session: ownerSession,
    });
    assert.equal((await connection.json()).data.email, 'new@google.test');

    const oldLogin = await api.request('auth/google/login', {
      method: 'POST',
      body: {},
    });
    const oldState = stateFrom(await oldLogin.json());
    const oldCookies = oldLogin.headers.getSetCookie()[0].split(';', 1)[0];
    assert.match(
      (
        await api.request(`auth/google/callback?state=${oldState}&code=old`, {
          session: { cookies: oldCookies, data: null },
          redirect: 'manual',
        })
      ).headers.get('location') ?? '',
      /google=unlinked/,
    );
    const newLogin = await api.request('auth/google/login', {
      method: 'POST',
      body: {},
    });
    const newState = stateFrom(await newLogin.json());
    const newCookies = newLogin.headers.getSetCookie()[0].split(';', 1)[0];
    assert.match(
      (
        await api.request(`auth/google/callback?state=${newState}&code=new`, {
          session: { cookies: newCookies, data: null },
          redirect: 'manual',
        })
      ).headers.get('location') ?? '',
      /google=signed-in/,
    );

    await api.connection
      .collection('google_accounts')
      .updateOne(
        { email: 'new@google.test' },
        { $set: { changeCodeSentAt: new Date(0) } },
      );
    await api.request('auth/google/change/request', {
      method: 'POST',
      session: ownerSession,
    });
    const expiredCode = /es ([A-Z0-9]{6})\./.exec(sent.at(-1)!.text)?.[1];
    assert.ok(expiredCode);
    await api.connection.collection('google_accounts').updateOne(
      { email: 'new@google.test' },
      {
        $set: {
          changeCodeExpiresAt: new Date(0),
          changeCodeSentAt: new Date(0),
        },
      },
    );
    assert.equal(
      (
        await api.request('auth/google/change/confirm', {
          method: 'POST',
          session: ownerSession,
          body: { code: expiredCode },
        })
      ).status,
      401,
    );
    await api.request('auth/google/change/request', {
      method: 'POST',
      session: ownerSession,
    });
    const lockedCode = /es ([A-Z0-9]{6})\./.exec(sent.at(-1)!.text)?.[1];
    assert.ok(lockedCode);
    const wrongCode = lockedCode === 'AAAAAA' ? 'BBBBBB' : 'AAAAAA';
    for (let attempt = 0; attempt < 5; attempt++) {
      assert.equal(
        (
          await api.request('auth/google/change/confirm', {
            method: 'POST',
            session: ownerSession,
            body: { code: wrongCode },
          })
        ).status,
        401,
      );
    }
    assert.equal(
      (
        await api.request('auth/google/change/confirm', {
          method: 'POST',
          session: ownerSession,
          body: { code: lockedCode },
        })
      ).status,
      401,
    );

    const otherLink = await api.request('auth/google/link', {
      method: 'POST',
      session: developerSession,
    });
    const otherState = stateFrom(await otherLink.json());
    await api.request(`auth/google/callback?state=${otherState}&code=taken`, {
      session: developerSession,
      redirect: 'manual',
    });
    await api.connection
      .collection('google_accounts')
      .updateOne(
        { email: 'new@google.test' },
        { $set: { changeCodeSentAt: new Date(0) } },
      );
    await api.request('auth/google/change/request', {
      method: 'POST',
      session: ownerSession,
    });
    const nextCode = /es ([A-Z0-9]{6})\./.exec(sent.at(-1)!.text)?.[1];
    assert.ok(nextCode);
    const nextStart = await api.request('auth/google/change/confirm', {
      method: 'POST',
      session: ownerSession,
      body: { code: nextCode },
    });
    assert.equal(nextStart.status, 200);
    const nextState = stateFrom(await nextStart.json());
    const duplicate = await api.request(
      `auth/google/callback?state=${nextState}&code=taken`,
      { session: ownerSession, redirect: 'manual' },
    );
    assert.match(
      duplicate.headers.get('location') ?? '',
      /google=already-used/,
    );
    const stillLinked = await api.request('auth/google/connection', {
      session: ownerSession,
    });
    assert.equal((await stillLinked.json()).data.email, 'new@google.test');
  } finally {
    await api.close();
  }
});
