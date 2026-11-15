import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditsModule } from '../audits/audits.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { Event, EventSchema } from './schemas/event.schema';
import { Tenant, TenantSchema } from '../tenants/schemas/tenant.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Event.name, schema: EventSchema },
      { name: Tenant.name, schema: TenantSchema },
    ]),
    AuditsModule,
    MembershipsModule,
    BudgetsModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
