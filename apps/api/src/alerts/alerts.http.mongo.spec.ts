import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { getConnectionToken } from '@nestjs/mongoose';
import cookieParser from 'cookie-parser';
import { Types, type Connection } from 'mongoose';
import { AppModule } from '../app.module';
import { AlertsService } from './alerts.service';

test('HTTP y Mongo aislado: sesión, permisos y lectura personal', async () => {
  const database = `evoria_alertas_test_${new Types.ObjectId().toString()}`;
  assert.match(database, /^evoria_alertas_test_[a-f0-9]{24}$/);
  const mongoHost = process.env.EVORIA_TEST_MONGO_HOST ?? '127.0.0.1:27017';
  const mongoUri = new URL(
    process.env.EVORIA_TEST_MONGO_URI ?? `mongodb://${mongoHost}`,
  );
  mongoUri.pathname = `/${database}`;
  process.env.MONGODB_URI = mongoUri.toString();
  process.env.JWT_ACCESS_SECRET = 'test-alerts-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-alerts-refresh-secret';
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  let connection: Connection | undefined;
  try {
    await app.listen(0, '127.0.0.1');
    connection = app.get<Connection>(getConnectionToken());
    const tenant = new Types.ObjectId();
    const owner = new Types.ObjectId();
    const other = new Types.ObjectId();
    const profile = new Types.ObjectId();
    const permissionKeys = [
      'alertas.ver',
      'alertas.editar',
      'eventos.ver',
      'presupuestos.ver',
      'presupuestos.editar',
      'presupuestos.aprobar',
    ];
    const permissionIds = permissionKeys.map(() => new Types.ObjectId());
    await connection.collection('permissions').insertMany(
      permissionKeys.map((key, index) => ({
        _id: permissionIds[index],
        key,
        status: 'activo',
      })),
    );
    await connection.collection('profiles').insertOne({
      _id: profile,
      tenantId: tenant,
      scope: 'tenant',
      status: 'activo',
      permissionIds,
    });
    await connection
      .collection('tenants')
      .insertOne({ _id: tenant, status: 'activo' });
    await connection.collection('users').insertMany(
      [owner, other].map((id) => ({
        _id: id,
        name: 'Persona',
        email: `${id.toString()}@example.test`,
        status: 'activo',
      })),
    );
    const ownerMembership = new Types.ObjectId();
    const otherMembership = new Types.ObjectId();
    await connection.collection('memberships').insertMany([
      {
        _id: ownerMembership,
        tenantId: tenant,
        userId: owner,
        profileId: profile,
        status: 'activo',
      },
      {
        _id: otherMembership,
        tenantId: tenant,
        userId: other,
        profileId: profile,
        status: 'activo',
      },
    ]);
    const eventId = new Types.ObjectId();
    await connection.collection('events').insertOne({
      _id: eventId,
      tenantId: tenant,
      responsibleUserId: owner,
      status: 'planificado',
    });
    await app.get(AlertsService).emit({
      tenantId: tenant.toString(),
      recipientId: owner.toString(),
      type: 'event_responsibility',
      title: 'Responsable',
      message: 'Evento asignado.',
      severity: 'info',
      eventId: eventId.toString(),
      dedupeKey: 'http-test',
      permissions: ['eventos.ver'],
    });
    const jwt = new JwtService();
    const token = (id: Types.ObjectId, membershipId: Types.ObjectId) =>
      jwt.sign(
        {
          sub: id.toString(),
          email: `${id.toString()}@example.test`,
          scope: 'tenant',
          tenantId: tenant.toString(),
          membershipId: membershipId.toString(),
          profileId: profile.toString(),
        },
        { secret: process.env.JWT_ACCESS_SECRET },
      );
    const cookie = (id: Types.ObjectId, membershipId: Types.ObjectId) => ({
      Cookie: `evoria_access_token=${token(id, membershipId)}`,
    });
    const address = app.getHttpServer().address() as AddressInfo;
    const base = `http://127.0.0.1:${address.port}/api/alerts`;
    assert.equal((await fetch(base)).status, 401);
    const ownerResponse = await fetch(base, {
      headers: cookie(owner, ownerMembership),
    });
    assert.equal(ownerResponse.status, 200);
    assert.equal(
      (
        await fetch(`${base}?page=0`, {
          headers: cookie(owner, ownerMembership),
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await fetch(`${base}/id-invalido`, {
          headers: cookie(owner, ownerMembership),
        })
      ).status,
      400,
    );
    const ownerBody = (await ownerResponse.json()) as {
      data: { items: Array<{ id: string }> };
    };
    assert.equal(ownerBody.data.items.length, 1);
    const id = ownerBody.data.items[0].id;
    assert.equal(
      (
        await fetch(`${base}/${id}/read`, {
          method: 'PATCH',
          headers: cookie(other, otherMembership),
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await fetch(`${base}/${id}/read`, {
          method: 'PATCH',
          headers: cookie(owner, ownerMembership),
        })
      ).status,
      200,
    );
    const countResponse = await fetch(`${base}/unread-count`, {
      headers: cookie(owner, ownerMembership),
    });
    const countBody = (await countResponse.json()) as {
      data: { count: number };
    };
    assert.equal(countBody.data.count, 0);
    await connection.collection('event_budgets').insertOne({
      _id: new Types.ObjectId(),
      tenantId: tenant,
      eventId,
      baseAmountCop: 1000,
      approvedIncreaseCop: 0,
      inventorySpentCop: 0,
      providerSpentCop: 0,
      extraSpentCop: 0,
      requests: [],
      createdBy: other,
    });
    const api = `http://127.0.0.1:${address.port}/api`;
    const requestResponse = await fetch(
      `${api}/events/${eventId}/budget/requests`,
      {
        method: 'POST',
        headers: {
          ...cookie(other, otherMembership),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'ampliacion',
          amountCop: 100,
          reason: 'Ampliación para el evento',
        }),
      },
    );
    assert.equal(requestResponse.status, 201);
    const request = (await requestResponse.json()) as { data: { id: string } };
    const authorizations = await fetch(`${api}/budgets/authorizations`, {
      headers: cookie(owner, ownerMembership),
    });
    assert.equal(authorizations.status, 200);
    const pending = (await authorizations.json()) as {
      data: Array<{ id: string }>;
    };
    assert.ok(pending.data.some((entry) => entry.id === request.data.id));
    const currentAlerts = await fetch(base, {
      headers: cookie(owner, ownerMembership),
    });
    const currentBody = (await currentAlerts.json()) as {
      data: { items: Array<{ id: string; type: string }> };
    };
    const pendingAlert = currentBody.data.items.find(
      (entry) => entry.type === 'budget_pending',
    );
    assert.ok(pendingAlert);
    assert.equal(
      (
        await fetch(`${base}/${pendingAlert.id}/read`, {
          method: 'PATCH',
          headers: cookie(owner, ownerMembership),
        })
      ).status,
      200,
    );
    const stillPending = await connection
      .collection('event_budgets')
      .findOne({ tenantId: tenant, eventId });
    assert.equal(
      (stillPending?.requests as Array<{ status: string }>)[0].status,
      'pendiente',
    );
    const decisionUrl = `${api}/events/${eventId}/budget/requests/${request.data.id}/approve`;
    assert.equal(
      (
        await fetch(decisionUrl, {
          method: 'POST',
          headers: cookie(other, otherMembership),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(decisionUrl, {
          method: 'POST',
          headers: cookie(owner, ownerMembership),
        })
      ).status,
      201,
    );
    // El cliente puede haber perdido la respuesta: la solicitud es la fuente
    // de verdad para recuperar el resultado antes de intentar otra decisión.
    const detailResponse = await fetch(`${api}/events/${eventId}/budget`, {
      headers: cookie(owner, ownerMembership),
    });
    assert.equal(detailResponse.status, 200);
    const detail = (await detailResponse.json()) as {
      data: {
        requests: Array<{ id: string; status: string; decidedBy: string }>;
      };
    };
    const recovered = detail.data.requests.find(
      (entry) => entry.id === request.data.id,
    );
    assert.equal(recovered?.status, 'aprobada');
    assert.equal(recovered?.decidedBy, owner.toString());
    assert.equal(
      (
        await fetch(decisionUrl, {
          method: 'POST',
          headers: cookie(owner, ownerMembership),
        })
      ).status,
      409,
    );
    const rejectedResponse = await fetch(
      `${api}/events/${eventId}/budget/requests`,
      {
        method: 'POST',
        headers: {
          ...cookie(other, otherMembership),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'costo_adicional',
          amountCop: 50,
          reason: 'Costo adicional del evento',
        }),
      },
    );
    assert.equal(rejectedResponse.status, 201);
    const rejected = (await rejectedResponse.json()) as {
      data: { id: string };
    };
    const rejectUrl = `${api}/events/${eventId}/budget/requests/${rejected.data.id}/reject`;
    const rejection = await fetch(rejectUrl, {
      method: 'POST',
      headers: {
        ...cookie(owner, ownerMembership),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'No está dentro del alcance aprobado' }),
    });
    assert.equal(rejection.status, 201);
    const rejectedBody = (await rejection.json()) as {
      data: { status: string; rejectionReason: string };
    };
    assert.equal(rejectedBody.data.status, 'rechazada');
    assert.equal(
      rejectedBody.data.rejectionReason,
      'No está dentro del alcance aprobado',
    );
    const requesterAlerts = await fetch(base, {
      headers: cookie(other, otherMembership),
    });
    const requesterBody = (await requesterAlerts.json()) as {
      data: { items: Array<{ type: string }> };
    };
    assert.ok(
      requesterBody.data.items.some((entry) => entry.type === 'budget_decided'),
    );
    await connection
      .collection('permissions')
      .updateOne({ key: 'alertas.ver' }, { $set: { status: 'inactivo' } });
    assert.equal(
      (await fetch(base, { headers: cookie(owner, ownerMembership) })).status,
      403,
    );
  } finally {
    if (connection) await connection.dropDatabase();
    await app.close();
  }
});
