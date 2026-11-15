import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditsModule } from '../audits/audits.module';
import {
  Membership,
  MembershipSchema,
} from '../memberships/schemas/membership.schema';
import { Schedule, ScheduleSchema } from '../schedules/schemas/schedule.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Team, TeamSchema } from './schemas/team.schema';
import {
  TeamSpecialty,
  TeamSpecialtySchema,
} from './schemas/team-specialty.schema';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [
    AuditsModule,
    MongooseModule.forFeature([
      { name: Team.name, schema: TeamSchema },
      { name: TeamSpecialty.name, schema: TeamSpecialtySchema },
      { name: Membership.name, schema: MembershipSchema },
      { name: User.name, schema: UserSchema },
      { name: Schedule.name, schema: ScheduleSchema },
    ]),
  ],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}
