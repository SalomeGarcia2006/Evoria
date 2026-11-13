import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import cookieParser from 'cookie-parser';
import { Types, type Connection } from 'mongoose';
import { AppModule } from './app.module';
import { AccessControlSeedService } from './profiles/access-control.seed.service';
import { DEVELOPER_PROFILE_NAME } from './profiles/profiles.constants';
import { PasswordService } from './users/password.service';

function cookies(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';', 1)[0])
    .join('; ');
}

test('HTTP y Mongo aislado: autenticación, empresa y gestión básica', async () => {
  const database = `evoria_core_test_${new Types.ObjectId().toString()}`;
  const mongoUri = new URL(
    process.env.EVORIA_TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27017',
  );
  mongoUri.pathname = `/${database}`;
  process.env.MONGODB_URI = mongoUri.toString();
  process.env.JWT_ACCESS_SECRET = 'test-core-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-core-refresh-secret';
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  let connection: Connection | undefined;

  try {
    await app.listen(0, '127.0.0.1');
    connection = app.get<Connection>(getConnectionToken());
    await app.get(AccessControlSeedService).seed();

    const developerProfile = await connection.collection('profiles').findOne({
      name: DEVELOPER_PROFILE_NAME,
      scope: 'platform',
    });
    assert.ok(developerProfile);
    const developerId = new Types.ObjectId();
    await connection.collection('users').insertOne({
      _id: developerId,
      name: 'Desarrollador de prueba',
      email: 'developer@example.test',
      passwordHash: app.get(PasswordService).hash('Prueba-segura1'),
      platformProfileId: developerProfile._id,
      status: 'activo',
      loginAttempts: 0,
      lockedUntil: null,
    });

    const address = app.getHttpServer().address() as AddressInfo;
    const api = `http://127.0.0.1:${address.port}/api`;
    assert.equal((await fetch(`${api}/events`)).status, 401);

    const login = await fetch(`${api}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'developer@example.test',
        password: 'Prueba-segura1',
      }),
    });
    assert.equal(login.status, 200);
    let sessionCookies = cookies(login);
    const platformSession = (await login.json()) as {
      data: { scope: string; isDeveloper: boolean };
    };
    assert.equal(platformSession.data.scope, 'platform');
    assert.equal(platformSession.data.isDeveloper, true);
    assert.equal(
      (await fetch(`${api}/events`, { headers: { Cookie: sessionCookies } }))
        .status,
      403,
    );

    const tenantResponse = await fetch(`${api}/tenants`, {
      method: 'POST',
      headers: {
        Cookie: sessionCookies,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Empresa de prueba',
        nit: '900123456-7',
        ownerName: 'Administradora de prueba',
        ownerEmail: 'owner@example.test',
        ownerPassword: 'Prueba-segura1',
      }),
    });
    assert.equal(tenantResponse.status, 201);
    const tenant = (await tenantResponse.json()) as { data: { id: string } };
    assert.equal(
      (await fetch(`${api}/tenants`, { headers: { Cookie: sessionCookies } }))
        .status,
      200,
    );

    const join = await fetch(`${api}/tenants/${tenant.data.id}/join`, {
      method: 'POST',
      headers: { Cookie: sessionCookies },
    });
    assert.equal(join.status, 200);
    sessionCookies = cookies(join);
    const tenantSession = (await join.json()) as {
      data: { scope: string; tenant: { id: string } };
    };
    assert.equal(tenantSession.data.scope, 'tenant');
    assert.equal(tenantSession.data.tenant.id, tenant.data.id);

    const profileResponse = await fetch(`${api}/profiles`, {
      method: 'POST',
      headers: {
        Cookie: sessionCookies,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Consulta de eventos',
        description: 'Perfil de lectura de eventos.',
        permissionKeys: ['eventos.ver'],
      }),
    });
    assert.equal(profileResponse.status, 201);
    const profile = (await profileResponse.json()) as { data: { id: string } };

    const userResponse = await fetch(`${api}/users`, {
      method: 'POST',
      headers: {
        Cookie: sessionCookies,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Usuario de prueba',
        email: 'user@example.test',
        password: 'Prueba-segura1',
        profileId: profile.data.id,
      }),
    });
    assert.equal(userResponse.status, 201);
    const user = (await userResponse.json()) as { data: { id: string } };
    assert.equal(
      (await fetch(`${api}/users`, { headers: { Cookie: sessionCookies } }))
        .status,
      200,
    );

    const eventResponse = await fetch(`${api}/events`, {
      method: 'POST',
      headers: {
        Cookie: sessionCookies,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Evento de prueba',
        startAt: '2030-01-10T10:00:00.000Z',
        endAt: '2030-01-10T18:00:00.000Z',
        baseBudget: 500000,
      }),
    });
    assert.equal(eventResponse.status, 201);
    const event = (await eventResponse.json()) as { data: { id: string } };

    const scheduleResponse = await fetch(
      `${api}/events/${event.data.id}/schedules`,
      {
        method: 'POST',
        headers: {
          Cookie: sessionCookies,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Montaje',
          startAt: '2030-01-10T10:00:00.000Z',
          endAt: '2030-01-10T12:00:00.000Z',
          responsibleUserId: user.data.id,
        }),
      },
    );
    assert.equal(scheduleResponse.status, 201);
    assert.equal(
      (
        await fetch(`${api}/events/${event.data.id}/schedules`, {
          headers: { Cookie: sessionCookies },
        })
      ).status,
      200,
    );

    const dashboard = await fetch(`${api}/dashboard/summary`, {
      headers: { Cookie: sessionCookies },
    });
    assert.equal(dashboard.status, 200);
    const dashboardBody = (await dashboard.json()) as {
      data: { events: { total: number }; budgets: { allocatedCop: number } };
    };
    assert.equal(dashboardBody.data.events.total, 1);
    assert.equal(dashboardBody.data.budgets.allocatedCop, 500000);

    const audit = await fetch(`${api}/audit-logs?module=eventos`, {
      headers: { Cookie: sessionCookies },
    });
    assert.equal(audit.status, 200);
    const auditBody = (await audit.json()) as {
      data: { items: Array<{ entityId: string }> };
    };
    assert.ok(
      auditBody.data.items.some((item) => item.entityId === event.data.id),
    );

    const leave = await fetch(`${api}/tenants/leave`, {
      method: 'POST',
      headers: { Cookie: sessionCookies },
    });
    assert.equal(leave.status, 200);
    sessionCookies = cookies(leave);
    assert.equal(
      (
        await fetch(`${api}/auth/me`, {
          headers: { Cookie: sessionCookies },
        })
      ).status,
      200,
    );
  } finally {
    if (connection) await connection.dropDatabase();
    await app.close();
  }
});
