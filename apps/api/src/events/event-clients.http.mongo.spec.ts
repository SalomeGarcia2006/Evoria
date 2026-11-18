import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import type { EventItem, EventList } from '@evoria/contracts';
import {
  createHttpTestApi,
  createTenantTestContext,
} from '../testing/http-test-api';
import { eventClientFixture } from '../testing/event-client.fixture';

test('HTTP: cliente del evento, validación, historial y aislamiento en MongoDB real', async (t) => {
  const api = await createHttpTestApi('event_clients', undefined, {
    send: async () => undefined,
  });
  try {
    const ctx = await createTenantTestContext(api);
    const owner = ctx.ownerSession;
    const tenant = new Types.ObjectId(ctx.tenantId);
    const ownerId = new Types.ObjectId(
      (owner.data as { user: { id: string } }).user.id,
    );
    const input = {
      name: 'Evento con cliente',
      startAt: '2030-01-10T10:00:00Z',
      endAt: '2030-01-10T18:00:00Z',
      baseBudget: 1000,
      client: eventClientFixture(),
    };
    const normalized = eventClientFixture({
      name: 'María López',
      identification: '0012345-A',
      email: 'contacto@example.test',
    });
    const get = (id: string) => api.request(`events/${id}`, { session: owner });
    const patch = (id: string, body: unknown) =>
      api.request(`events/${id}`, { method: 'PATCH', session: owner, body });
    const create = (body: unknown) =>
      api.request('events', { method: 'POST', session: owner, body });
    async function eventData(
      response: Response,
      status = 200,
    ): Promise<EventItem> {
      const body = (await response.json()) as { data: EventItem };
      assert.equal(response.status, status, JSON.stringify(body));
      return body.data;
    }
    let current!: EventItem;
    let independent!: EventItem;

    await t.test(
      'crea, guarda y devuelve un cliente completo sin alterar la inicialización presupuestal',
      async () => {
        current = await eventData(
          await create({
            ...input,
            tenantId: new Types.ObjectId().toString(),
            client: {
              ...normalized,
              name: '  María López  ',
              identification: ' 0012345-A ',
              email: ' CONTACTO@EXAMPLE.TEST ',
              tenantId: 'no-confiable',
              isDeveloper: true,
            },
          }),
          201,
        );
        assert.deepEqual(current.client, normalized);
        const stored = await api.connection
          .collection('events')
          .findOne({ _id: new Types.ObjectId(current.id) });
        assert.equal(stored?.tenantId.toString(), ctx.tenantId);
        assert.deepEqual(stored?.client, normalized);
        const budget = await api.connection
          .collection('event_budgets')
          .findOne({ eventId: stored!._id, tenantId: tenant });
        assert.equal(budget?.baseAmountCop, 1000);
        assert.equal(budget?.approvedIncreaseCop, 0);
        independent = await eventData(
          await create({ ...input, client: normalized }),
          201,
        );
        assert.notEqual(independent.id, current.id);
        assert.deepEqual(independent.client, normalized);
      },
    );

    await t.test(
      'detalle y listado incluyen cliente; editarlo solo afecta al evento elegido',
      async () => {
        assert.deepEqual(
          (await eventData(await get(current.id))).client,
          normalized,
        );
        const list = await api.request('events', { session: owner });
        assert.equal(list.status, 200);
        const body = (await list.json()) as { data: EventList };
        assert.deepEqual(
          body.data.items.find((e) => e.id === current.id)?.client,
          normalized,
        );
        const changed = {
          ...normalized,
          phone: '+57 310 456 7890',
          address: 'Carrera 50 # 10-20',
        };
        current = await eventData(await patch(current.id, { client: changed }));
        assert.deepEqual(current.client, changed);
        assert.deepEqual(
          (await eventData(await get(independent.id))).client,
          normalized,
        );
        assert.deepEqual(
          (
            await eventData(
              await patch(current.id, {
                description: 'Cambio sin reemplazar cliente',
              }),
            )
          ).client,
          changed,
        );
        const stored = await api.connection
          .collection('event_budgets')
          .findOne({ eventId: new Types.ObjectId(current.id) });
        assert.equal(stored?.baseAmountCop, 1000);
        const budget = await api.request(`events/${current.id}/budget`, {
          session: owner,
        });
        assert.equal(budget.status, 200);
        assert.doesNotMatch(
          await budget.text(),
          /contacto@example\.test|0012345-A|310 456 7890/,
        );
        const audits = await api.connection
          .collection('audit_logs')
          .find({ tenantId: tenant })
          .toArray();
        assert.ok(audits.length > 0);
        assert.doesNotMatch(
          JSON.stringify(audits),
          /contacto@example\.test|0012345-A|310 456 7890/,
        );
      },
    );

    await t.test(
      'rechaza clientes incompletos o inválidos sin guardar eventos, presupuestos ni cambios parciales',
      async () => {
        const before = await api.connection
          .collection('events')
          .countDocuments({ tenantId: tenant });
        const budgets = await api.connection
          .collection('event_budgets')
          .countDocuments({ tenantId: tenant });
        const missing: Partial<typeof input> = { ...input };
        delete missing.client;
        assert.equal((await create(missing)).status, 400);
        for (const client of [
          null,
          [],
          'persona',
          {},
          { name: 'Persona' },
          { ...normalized, phone: 'x' },
          { ...normalized, email: 'mal' },
          { ...normalized, identification: 1234 },
          { ...normalized, name: '  ' },
          { ...normalized, address: '' },
        ]) {
          assert.equal(
            (await create({ ...input, client })).status,
            400,
            JSON.stringify(client),
          );
          assert.equal(
            (await patch(current.id, { name: 'No debe persistir', client }))
              .status,
            400,
            JSON.stringify(client),
          );
        }
        assert.equal((await get(current.id)).status, 200);
        const saved = await eventData(await get(current.id));
        assert.equal(saved.name, current.name);
        assert.deepEqual(saved.client, current.client);
        assert.equal(
          await api.connection
            .collection('events')
            .countDocuments({ tenantId: tenant }),
          before,
        );
        assert.equal(
          await api.connection
            .collection('event_budgets')
            .countDocuments({ tenantId: tenant }),
          budgets,
        );
      },
    );

    await t.test(
      'conserva eventos históricos sin cliente y permite completarlos; cancelar preserva los datos',
      async () => {
        const legacyId = new Types.ObjectId();
        await api.connection.collection('events').insertOne({
          _id: legacyId,
          tenantId: tenant,
          createdBy: ownerId,
          name: 'Evento histórico',
          startAt: new Date(input.startAt),
          endAt: new Date(input.endAt),
          baseBudget: 0,
          status: 'borrador',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        assert.equal(
          (await eventData(await get(legacyId.toString()))).client,
          null,
        );
        assert.equal(
          (
            await eventData(
              await patch(legacyId.toString(), {
                description: 'Conservar sin inventar cliente',
              }),
            )
          ).client,
          null,
        );
        const client = eventClientFixture({
          identification: '0000000123',
          email: 'historico@example.test',
        });
        assert.deepEqual(
          (await eventData(await patch(legacyId.toString(), { client })))
            .client,
          client,
        );
        const cancelled = await eventData(
          await api.request(`events/${legacyId}`, {
            method: 'DELETE',
            session: owner,
          }),
        );
        assert.equal(cancelled.status, 'cancelado');
        assert.deepEqual(cancelled.client, client);
        assert.equal(
          (await patch(legacyId.toString(), { client: normalized })).status,
          409,
        );
        assert.deepEqual(
          (await eventData(await get(legacyId.toString()))).client,
          client,
        );
      },
    );

    await t.test(
      'otra empresa y usuarios sin permisos o membresía activa no consultan ni cambian el cliente',
      async () => {
        const foreignId = new Types.ObjectId();
        await api.connection.collection('events').insertOne({
          _id: foreignId,
          tenantId: new Types.ObjectId(),
          name: 'Evento ajeno',
          client: eventClientFixture({ email: 'secreto@example.test' }),
          createdBy: new Types.ObjectId(),
          status: 'borrador',
          startAt: new Date(input.startAt),
          endAt: new Date(input.endAt),
        });
        assert.equal((await get(foreignId.toString())).status, 404);
        assert.equal(
          (await patch(foreignId.toString(), { client: normalized })).status,
          404,
        );
        const list = await api.request('events', { session: owner });
        assert.doesNotMatch(
          await list.text(),
          /secreto@example\.test|Evento ajeno/,
        );
        assert.equal((await api.request(`events/${current.id}`)).status, 401);
        const p = await api.request('profiles', {
          method: 'POST',
          session: owner,
          body: {
            name: 'Sin eventos',
            description: 'Prueba de aislamiento',
            permissionKeys: ['dashboard.ver'],
          },
        });
        assert.equal(p.status, 201);
        const profile = (await p.json()) as { data: { id: string } };
        const fixture = await api.createUserFixture({
          session: owner,
          body: {
            name: 'Usuario restringido',
            email: 'restringido@example.test',
            password: 'Prueba-segura1',
            profileId: profile.data.id,
          },
        });
        assert.equal(fixture.status, 201);
        const restricted = await api.login(
          'restringido@example.test',
          'Prueba-segura1',
        );
        assert.equal(
          (await api.request(`events/${current.id}`, { session: restricted }))
            .status,
          403,
        );
        assert.equal(
          (
            await api.request(`events/${current.id}`, {
              method: 'PATCH',
              session: restricted,
              body: { client: normalized },
            })
          ).status,
          403,
        );
        await api.connection
          .collection('permissions')
          .updateOne({ key: 'eventos.ver' }, { $set: { status: 'inactivo' } });
        assert.equal((await get(current.id)).status, 403);
        await api.connection
          .collection('permissions')
          .updateOne({ key: 'eventos.ver' }, { $set: { status: 'activo' } });
        await api.connection
          .collection('memberships')
          .updateOne(
            { userId: ownerId, tenantId: tenant },
            { $set: { status: 'inactivo' } },
          );
        assert.equal((await get(current.id)).status, 401);
        await api.connection
          .collection('memberships')
          .updateOne(
            { userId: ownerId, tenantId: tenant },
            { $set: { status: 'activo' } },
          );
        assert.deepEqual(
          (await eventData(await get(current.id))).client,
          current.client,
        );
      },
    );
  } finally {
    await api.close();
  }
});
