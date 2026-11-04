/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types, type Connection } from 'mongoose';
import { releaseReturnedInventoryCostMigration } from './20261104-release-returned-inventory-cost.migration';

test('la conciliación descuenta devoluciones antiguas y se puede repetir', async () => {
  const tenantId = new Types.ObjectId();
  const eventId = new Types.ObjectId();
  const budget = {
    _id: new Types.ObjectId(),
    tenantId,
    eventId,
    inventorySpentCop: 100000,
  };
  const assignments = [
    { tenantId, eventId, status: 'asignado', costAmountCop: 40000 },
    { tenantId, eventId, status: 'devuelto', costAmountCop: 60000 },
  ];
  let updates = 0;
  const connection = {
    collection: (name: string) =>
      name === 'event_budgets'
        ? {
            find: () => [budget],
            updateOne: async (
              filter: { inventorySpentCop: number },
              update: { $set: { inventorySpentCop: number } },
            ) => {
              if (filter.inventorySpentCop !== budget.inventorySpentCop) {
                return { matchedCount: 0 };
              }
              budget.inventorySpentCop = update.$set.inventorySpentCop;
              updates += 1;
              return { matchedCount: 1 };
            },
          }
        : {
            find: () => ({ toArray: async () => assignments }),
          },
  } as unknown as Connection;

  await releaseReturnedInventoryCostMigration.up(connection);
  await releaseReturnedInventoryCostMigration.up(connection);

  assert.equal(budget.inventorySpentCop, 40000);
  assert.equal(updates, 1);
});
