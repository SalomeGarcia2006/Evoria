import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DashboardService } from './dashboard.service';

const tenantId = new Types.ObjectId().toString();
const user: AuthenticatedUser = {
  id: new Types.ObjectId().toString(),
  name: 'Ana García',
  email: 'ana@evoria.test',
  scope: 'tenant',
  profileId: new Types.ObjectId().toString(),
  tenantId,
};

function query<T>(value: T) {
  return {
    select: () => query(value),
    sort: () => query(value),
    limit: () => query(value),
    lean: async () => value,
  };
}

function createService(permissionKeys: string[]) {
  const filters: Record<string, unknown>[] = [];
  const eventId = new Types.ObjectId();
  const eventModel = {
    countDocuments: async (filter: Record<string, unknown>) => {
      filters.push(filter);
      return 4;
    },
    aggregate: async (pipeline: Array<Record<string, unknown>>) => {
      filters.push(pipeline[0].$match as Record<string, unknown>);
      return [
        { _id: 'borrador', count: 1 },
        { _id: 'planificado', count: 2 },
        { _id: 'finalizado', count: 1 },
      ];
    },
    find: (filter: Record<string, unknown>) => {
      filters.push(filter);
      if (filter.status && '$ne' in (filter.status as object)) {
        return query([{ _id: eventId }]);
      }
      return query([
        {
          _id: eventId,
          name: 'Feria Evoria',
          startAt: new Date('2026-12-01T10:00:00.000Z'),
          endAt: new Date('2026-12-01T18:00:00.000Z'),
          status: 'planificado',
        },
      ]);
    },
  };
  let inventoryCalls = 0;
  const inventoryModel = {
    aggregate: async (pipeline: Array<Record<string, unknown>>) => {
      inventoryCalls += 1;
      filters.push(pipeline[0].$match as Record<string, unknown>);
      return [
        {
          resources: 2,
          total: 20,
          available: 12,
          reserved: 5,
          maintenance: 1,
        },
      ];
    },
  };
  let budgetCalls = 0;
  const budgetModel = {
    find: (filter: Record<string, unknown>) => {
      budgetCalls += 1;
      filters.push(filter);
      return query([
        {
          baseAmountCop: 1000000,
          approvedIncreaseCop: 200000,
          inventorySpentCop: 300000,
          providerSpentCop: 400000,
          extraSpentCop: 50000,
        },
      ]);
    },
  };
  const profileModel = {
    findOne: (filter: Record<string, unknown>) => {
      filters.push(filter);
      return query({ permissionIds: [new Types.ObjectId()] });
    },
  };
  const permissionModel = {
    find: () => query(permissionKeys.map((key) => ({ key }))),
  };

  return {
    service: new DashboardService(
      eventModel as never,
      inventoryModel as never,
      budgetModel as never,
      profileModel as never,
      permissionModel as never,
    ),
    filters,
    get inventoryCalls() {
      return inventoryCalls;
    },
    get budgetCalls() {
      return budgetCalls;
    },
  };
}

test('resume métricas de la empresa activa', async () => {
  const state = createService([
    'eventos.ver',
    'inventario.ver',
    'presupuestos.ver',
  ]);

  const result = await state.service.summary(user);

  assert.equal(result.events?.total, 4);
  assert.equal(result.events?.active, 3);
  assert.equal(result.events?.byStatus.cancelado, 0);
  assert.equal(result.events?.upcoming[0]?.name, 'Feria Evoria');
  assert.deepEqual(result.inventory, {
    resources: 2,
    total: 20,
    available: 12,
    reserved: 5,
    maintenance: 1,
  });
  assert.deepEqual(result.budgets, {
    allocatedCop: 1200000,
    spentCop: 750000,
    remainingCop: 450000,
  });
  assert.ok(
    state.filters.every(
      (filter) => !('tenantId' in filter) || filter.tenantId === tenantId,
    ),
  );
});

test('oculta métricas de módulos sin permiso', async () => {
  const state = createService(['eventos.ver']);

  const result = await state.service.summary(user);

  assert.ok(result.events);
  assert.equal(result.inventory, null);
  assert.equal(result.budgets, null);
  assert.equal(state.inventoryCalls, 0);
  assert.equal(state.budgetCalls, 0);
});

test('requiere una empresa activa', async () => {
  const state = createService(['eventos.ver']);

  await assert.rejects(
    () =>
      state.service.summary({
        ...user,
        scope: 'platform',
        tenantId: undefined,
      }),
    ForbiddenException,
  );
});
