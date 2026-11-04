import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types, type Model } from 'mongoose';
import { AuditsService } from '../audits/audits.service';
import { Event } from '../events/schemas/event.schema';
import { InventoryItem } from '../inventory/schemas/inventory-item.schema';
import { EventProviderService } from '../provider-services/schemas/event-provider-service.schema';
import { Provider } from '../providers/schemas/provider.schema';
import { EventResource } from '../resources/schemas/event-resource.schema';
import { BudgetLedgerService } from './budget-ledger.service';
import { BudgetsService } from './budgets.service';
import { EventBudget } from './schemas/event-budget.schema';

test('iniciar un presupuesto antiguo solo cuenta las reservas activas', async () => {
  const tenantId = new Types.ObjectId().toString();
  const eventId = new Types.ObjectId().toString();
  let recordedInventoryCost: number | undefined;
  const budgetModel = {
    exists: async () => false,
    create: async (data: { inventorySpentCop: number }) => {
      recordedInventoryCost = data.inventorySpentCop;
      return {
        ...data,
        _id: new Types.ObjectId(),
        baseAmountCop: 100000,
        approvedIncreaseCop: 0,
        providerSpentCop: 0,
        extraSpentCop: 0,
      };
    },
  } as unknown as Model<EventBudget>;
  const assignments = [
    {
      _id: new Types.ObjectId(),
      inventoryItemId: new Types.ObjectId(),
      quantity: 4,
      costAmountCop: 40000,
      status: 'asignado',
    },
    {
      _id: new Types.ObjectId(),
      inventoryItemId: new Types.ObjectId(),
      quantity: 6,
      costAmountCop: 60000,
      status: 'devuelto',
    },
  ];
  const service = new BudgetsService(
    budgetModel,
    {
      findOne: async () => ({ status: 'confirmado', baseBudget: 100000 }),
    } as unknown as Model<Event>,
    {
      find: () => ({ lean: async () => assignments }),
    } as unknown as Model<EventResource>,
    {
      find: () => ({ lean: async () => [] }),
    } as unknown as Model<InventoryItem>,
    {
      find: () => ({ select: () => ({ lean: async () => [] }) }),
    } as unknown as Model<EventProviderService>,
    {} as Model<Provider>,
    {} as BudgetLedgerService,
    {} as AuditsService,
  );

  const result = await service.initializeForEvent(
    eventId,
    tenantId,
    100000,
    new Types.ObjectId().toString(),
  );

  assert.equal(recordedInventoryCost, 40000);
  assert.equal(result.inventorySpentCop, 40000);
  assert.equal(result.remainingCop, 60000);
});
