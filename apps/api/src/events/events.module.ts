import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MembershipsModule } from '../memberships/memberships.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { Event, EventSchema } from './schemas/event.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Event.name, schema: EventSchema }]),
    MembershipsModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
