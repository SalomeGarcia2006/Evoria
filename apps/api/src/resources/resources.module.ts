import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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
    InventoryModule,
    MongooseModule.forFeature([
      { name: Event.name, schema: EventSchema },
      { name: EventResource.name, schema: EventResourceSchema },
    ]),
  ],
  controllers: [ResourcesController],
  providers: [ResourcesService],
})
export class ResourcesModule {}
