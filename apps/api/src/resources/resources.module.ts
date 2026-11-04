import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditsModule } from '../audits/audits.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { InventoryModule } from '../inventory/inventory.module';
import { Event, EventSchema } from '../events/schemas/event.schema';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';
import {
  EventResource,
  EventResourceSchema,
} from './schemas/event-resource.schema';

@Module({
  imports: [
    AuditsModule,
    InventoryModule,
    BudgetsModule,
    MongooseModule.forFeature([
      { name: Event.name, schema: EventSchema },
      { name: EventResource.name, schema: EventResourceSchema },
    ]),
  ],
  controllers: [ResourcesController],
  providers: [ResourcesService],
})
export class ResourcesModule {}
