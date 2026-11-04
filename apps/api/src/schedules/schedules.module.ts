import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditsModule } from '../audits/audits.module';
import { Event, EventSchema } from '../events/schemas/event.schema';
import {
  Membership,
  MembershipSchema,
} from '../memberships/schemas/membership.schema';
import { Schedule, ScheduleSchema } from './schemas/schedule.schema';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [
    AuditsModule,
    MongooseModule.forFeature([
      { name: Schedule.name, schema: ScheduleSchema },
      { name: Event.name, schema: EventSchema },
      { name: Membership.name, schema: MembershipSchema },
    ]),
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService],
})
export class SchedulesModule {}
