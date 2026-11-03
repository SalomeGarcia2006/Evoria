import { addEventBaseBudgetMigration } from './20261028-add-event-base-budget.migration';
import type { Migration } from './migration';

export const MIGRATIONS: Migration[] = [addEventBaseBudgetMigration];
