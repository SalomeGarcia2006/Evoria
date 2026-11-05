import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Event, EventSchema } from '../events/schemas/event.schema';
import {
  EventBudget,
  EventBudgetSchema,
} from '../budgets/schemas/event-budget.schema';
import {
  Membership,
  MembershipSchema,
} from '../memberships/schemas/membership.schema';
import {
  Permission,
  PermissionSchema,
} from '../permissions/schemas/permission.schema';
import { Profile, ProfileSchema } from '../profiles/schemas/profile.schema';
import { Alert, AlertSchema } from './alert.schema';
import { AlertOutbox, AlertOutboxSchema } from './alert-outbox.schema';
import { AlertCondition, AlertConditionSchema } from './alert-condition.schema';
import {
  InventoryItem,
  InventoryItemSchema,
} from '../inventory/schemas/inventory-item.schema';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Alert.name, schema: AlertSchema },
      { name: AlertOutbox.name, schema: AlertOutboxSchema },
      { name: AlertCondition.name, schema: AlertConditionSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: Event.name, schema: EventSchema },
      { name: EventBudget.name, schema: EventBudgetSchema },
      { name: Membership.name, schema: MembershipSchema },
      { name: Permission.name, schema: PermissionSchema },
      { name: Profile.name, schema: ProfileSchema },
    ]),
  ],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
