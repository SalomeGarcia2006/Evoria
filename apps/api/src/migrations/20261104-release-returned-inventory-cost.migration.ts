import type { Types } from 'mongoose';
import type { Migration } from './migration';

type BudgetRecord = {
  tenantId: Types.ObjectId;
  eventId: Types.ObjectId;
  inventorySpentCop: number;
};

type AssignmentRecord = {
  tenantId: Types.ObjectId;
  eventId: Types.ObjectId;
  status: 'asignado' | 'devuelto';
  costAmountCop?: number;
};

export const releaseReturnedInventoryCostMigration: Migration = {
  id: '20261104-release-returned-inventory-cost',
  async up(connection) {
    const budgets = connection.collection<BudgetRecord>('event_budgets');
    const resources =
      connection.collection<AssignmentRecord>('event_resources');

    for await (const budget of budgets.find()) {
      const assignments = await resources
        .find({ tenantId: budget.tenantId, eventId: budget.eventId })
        .toArray();
      if (!assignments.some((assignment) => assignment.status === 'devuelto')) {
        continue;
      }

      let activeCostCop = 0;
      for (const assignment of assignments) {
        if (assignment.status !== 'asignado') continue;
        const amount = assignment.costAmountCop;
        if (!Number.isSafeInteger(amount) || amount! < 0) {
          throw new Error(
            `Falta el costo de una asignación activa del evento ${budget.eventId.toString()}.`,
          );
        }
        activeCostCop += amount!;
      }

      if (
        !Number.isSafeInteger(activeCostCop) ||
        activeCostCop > budget.inventorySpentCop
      ) {
        throw new Error(
          `El gasto de inventario del evento ${budget.eventId.toString()} no se puede conciliar.`,
        );
      }
      if (activeCostCop === budget.inventorySpentCop) continue;

      const result = await budgets.updateOne(
        { _id: budget._id, inventorySpentCop: budget.inventorySpentCop },
        { $set: { inventorySpentCop: activeCostCop } },
      );
      if (result.matchedCount !== 1) {
        throw new Error(
          `El presupuesto del evento ${budget.eventId.toString()} cambió durante la conciliación.`,
        );
      }
    }
  },
};
