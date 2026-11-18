import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Event, EventSchema } from '../events/schemas/event.schema';
import {
  EventBudget,
  EventBudgetSchema,
} from '../budgets/schemas/event-budget.schema';
import {
  InventoryItem,
  InventoryItemSchema,
} from '../inventory/schemas/inventory-item.schema';
import {
  EventResource,
  EventResourceSchema,
} from '../resources/schemas/event-resource.schema';
import {
  EventProviderService,
  EventProviderServiceSchema,
} from '../provider-services/schemas/event-provider-service.schema';
import { Schedule, ScheduleSchema } from '../schedules/schemas/schedule.schema';
import { Profile, ProfileSchema } from '../profiles/schemas/profile.schema';
import {
  Permission,
  PermissionSchema,
} from '../permissions/schemas/permission.schema';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsPdfService } from './reports-pdf.service';
import { Tenant, TenantSchema } from '../tenants/schemas/tenant.schema';
import { Team, TeamSchema } from '../teams/schemas/team.schema';
import {
  Membership,
  MembershipSchema,
} from '../memberships/schemas/membership.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Provider, ProviderSchema } from '../providers/schemas/provider.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Event.name, schema: EventSchema },
      { name: EventBudget.name, schema: EventBudgetSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: EventResource.name, schema: EventResourceSchema },
      { name: EventProviderService.name, schema: EventProviderServiceSchema },
      { name: Schedule.name, schema: ScheduleSchema },
      { name: Profile.name, schema: ProfileSchema },
      { name: Permission.name, schema: PermissionSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: Team.name, schema: TeamSchema },
      { name: Membership.name, schema: MembershipSchema },
      { name: User.name, schema: UserSchema },
      { name: Provider.name, schema: ProviderSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsPdfService],
})
export class ReportsModule {}
