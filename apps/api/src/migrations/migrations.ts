import { addEventBaseBudgetMigration } from './20261028-add-event-base-budget.migration';
import { releaseReturnedInventoryCostMigration } from './20261104-release-returned-inventory-cost.migration';
import type { Migration } from './migration';

export const MIGRATIONS: Migration[] = [
  addEventBaseBudgetMigration,
  releaseReturnedInventoryCostMigration,
];
