import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Types, type Model } from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BudgetLedgerService } from '../budgets/budget-ledger.service';
import { Event } from '../events/schemas/event.schema';
import { InventoryItem } from '../inventory/schemas/inventory-item.schema';
import { EventResource } from './schemas/event-resource.schema';
import { ResourcesService } from './resources.service';

const tenantId = new Types.ObjectId().toString();
const eventId = new Types.ObjectId().toString();
const itemId = new Types.ObjectId().toString();
const user = {
  id: new Types.ObjectId().toString(),
  scope: 'tenant',
  tenantId,
} as AuthenticatedUser;

function fixture(
  options: {
    budget?: boolean;
    failInventory?: boolean;
    failBudget?: boolean;
  } = {},
) {
  const assignment = {
    _id: new Types.ObjectId(),
    eventId: new Types.ObjectId(eventId),
    inventoryItemId: new Types.ObjectId(itemId),
    quantity: 10,
    costAmountCop: 100000,
    status: 'asignado',
    assignedAt: new Date(),
    returnedAt: null as Date | null,
  };
  const item = {
    _id: new Types.ObjectId(itemId),
    name: 'Sillas',
    type: 'Mobiliario',
    unitCost: 10000,
    availableQuantity: 5,
    reservedQuantity: 10,
  };
  let releases = 0;
  const assignmentModel = {
    findOneAndUpdate: async (
      filter: { status: string },
      update: { $set: { status: string; returnedAt: Date } },
    ) => {
      if (assignment.status !== filter.status) return null;
      assignment.status = update.$set.status;
      assignment.returnedAt = update.$set.returnedAt;
      return assignment;
    },
    updateOne: async (
      _filter: unknown,
      update: { $set: { status: string; returnedAt: null } },
    ) => {
      assignment.status = update.$set.status;
      assignment.returnedAt = update.$set.returnedAt;
    },
  } as unknown as Model<EventResource>;
  const inventoryModel = {
    findOneAndUpdate: async (
      filter: {
        reservedQuantity?: { $gte: number };
        availableQuantity?: { $gte: number };
      },
      update: { $inc: { availableQuantity: number; reservedQuantity: number } },
    ) => {
      if (options.failInventory && filter.reservedQuantity) return null;
      if (
        filter.reservedQuantity &&
        item.reservedQuantity < filter.reservedQuantity.$gte
      )
        return null;
      if (
        filter.availableQuantity &&
        item.availableQuantity < filter.availableQuantity.$gte
      )
        return null;
      item.availableQuantity += update.$inc.availableQuantity;
      item.reservedQuantity += update.$inc.reservedQuantity;
      return item;
    },
  } as unknown as Model<InventoryItem>;
  const ledger = {
    hasBudget: async () => options.budget !== false,
    releaseInventoryCost: async (
      _tenant: string,
      _event: string,
      amount: number,
    ) => {
      if (options.failBudget) throw new ConflictException('Falló el ajuste');
      assert.equal(amount, 100000);
      releases += 1;
    },
  } as unknown as BudgetLedgerService;
  const service = new ResourcesService(
    assignmentModel,
    inventoryModel,
    {
      findOne: async () => ({ status: 'confirmado' }),
    } as unknown as Model<Event>,
    ledger,
  );
  return {
    service,
    assignment,
    item,
    get releases() {
      return releases;
    },
  };
}

test('devolver inventario libera una vez el costo registrado al asignarlo', async () => {
  const state = fixture();
  const result = await state.service.release(eventId, itemId, user);

  assert.equal(result.status, 'devuelto');
  assert.equal(state.assignment.status, 'devuelto');
  assert.equal(state.item.availableQuantity, 15);
  assert.equal(state.item.reservedQuantity, 0);
  assert.equal(state.releases, 1);
  await assert.rejects(
    () => state.service.release(eventId, itemId, user),
    NotFoundException,
  );
  assert.equal(state.releases, 1);
});

test('si no se puede devolver inventario, no se libera presupuesto', async () => {
  const state = fixture({ failInventory: true });

  await assert.rejects(
    () => state.service.release(eventId, itemId, user),
    ConflictException,
  );
  assert.equal(state.assignment.status, 'asignado');
  assert.equal(state.item.availableQuantity, 5);
  assert.equal(state.item.reservedQuantity, 10);
  assert.equal(state.releases, 0);
});

test('si falla el ajuste de presupuesto, se revierte la devolución', async () => {
  const state = fixture({ failBudget: true });

  await assert.rejects(
    () => state.service.release(eventId, itemId, user),
    ConflictException,
  );
  assert.equal(state.assignment.status, 'asignado');
  assert.equal(state.item.availableQuantity, 5);
  assert.equal(state.item.reservedQuantity, 10);
  assert.equal(state.releases, 0);
});

test('una asignación anterior sin presupuesto se puede devolver', async () => {
  const state = fixture({ budget: false });

  await state.service.release(eventId, itemId, user);
  assert.equal(state.assignment.status, 'devuelto');
  assert.equal(state.releases, 0);
});
