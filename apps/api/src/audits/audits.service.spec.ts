import assert from 'node:assert/strict';
import test from 'node:test';
import { Types } from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditsService } from './audits.service';

const tenantId = new Types.ObjectId().toString();
const user: AuthenticatedUser = {
  id: new Types.ObjectId().toString(),
  name: 'Ana García',
  email: 'ana@evoria.test',
  scope: 'tenant',
  profileId: new Types.ObjectId().toString(),
  tenantId,
};

test('registra una acción sin datos sensibles', async () => {
  let created: Record<string, unknown> | undefined;
  const service = new AuditsService({
    create: async (value: Record<string, unknown>) => {
      created = value;
    },
  } as never);

  const eventId = new Types.ObjectId().toString();
  await service.record({
    tenantId,
    actor: user,
    module: 'eventos',
    action: 'crear',
    entity: 'evento',
    entityId: eventId,
    description: 'Creó el evento Feria de prueba.',
  });

  assert.deepEqual(created, {
    tenantId,
    actorUserId: user.id,
    actorName: user.name,
    module: 'eventos',
    action: 'crear',
    entity: 'evento',
    entityId: eventId,
    description: 'Creó el evento Feria de prueba.',
  });
});

test('consulta únicamente los registros de la empresa activa', async () => {
  let receivedFilter: Record<string, unknown> | undefined;
  const itemId = new Types.ObjectId();
  const model = {
    find: (filter: Record<string, unknown>) => {
      receivedFilter = filter;
      const query = {
        sort: () => query,
        skip: () => query,
        limit: () => query,
        lean: async () => [
          {
            _id: itemId,
            actorUserId: new Types.ObjectId(user.id),
            actorName: user.name,
            module: 'eventos',
            action: 'crear',
            entity: 'evento',
            entityId: new Types.ObjectId(),
            description: 'Creó un evento.',
            createdAt: new Date('2026-11-04T12:00:00.000Z'),
          },
        ],
      };
      return query;
    },
    countDocuments: async () => 1,
  };
  const service = new AuditsService(model as never);

  const result = await service.findAll({ page: 1, limit: 20 }, user);

  assert.deepEqual(receivedFilter, { tenantId });
  assert.equal(result.items[0]?.userId, user.id);
  assert.equal(result.pagination.total, 1);
});
