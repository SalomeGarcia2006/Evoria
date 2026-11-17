import { addEventBaseBudgetMigration } from './20261028-add-event-base-budget.migration';
import { releaseReturnedInventoryCostMigration } from './20261104-release-returned-inventory-cost.migration';
import { addEventInvitadosMigration } from './20261115-add-event-invitados.migration';
import { addRegistrationIndexesMigration } from './20261117-add-registration-indexes.migration';
import { disableUserCreatePermissionMigration } from './20261117-disable-user-create-permission.migration';
import type { Migration } from './migration';

export const MIGRATIONS: Migration[] = [
  addEventBaseBudgetMigration,
  releaseReturnedInventoryCostMigration,
  addEventInvitadosMigration,
  addRegistrationIndexesMigration,
  disableUserCreatePermissionMigration,
];
