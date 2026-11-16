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
import { Team, TeamSchema } from '../teams/schemas/team.schema';
import { ScheduleTeamsService } from './schedule-teams.service';
import {
  TeamActivityLog,
  TeamActivityLogSchema,
} from './schemas/team-activity-log.schema';

@Module({
  imports: [
    AuditsModule,
    MongooseModule.forFeature([
      { name: Schedule.name, schema: ScheduleSchema },
      { name: Event.name, schema: EventSchema },
      { name: Membership.name, schema: MembershipSchema },
      { name: Team.name, schema: TeamSchema },
      { name: TeamActivityLog.name, schema: TeamActivityLogSchema },
    ]),
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService, ScheduleTeamsService],
})
export class SchedulesModule {}
