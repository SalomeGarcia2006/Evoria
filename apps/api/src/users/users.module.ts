import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditsModule } from '../audits/audits.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { InitialAdminSeedService } from './initial-admin.seed.service';
import { PasswordService } from './password.service';
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Team, TeamSchema } from '../teams/schemas/team.schema';
import { Event, EventSchema } from '../events/schemas/event.schema';
import { Schedule, ScheduleSchema } from '../schedules/schemas/schedule.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Team.name, schema: TeamSchema },
      { name: Event.name, schema: EventSchema },
      { name: Schedule.name, schema: ScheduleSchema },
    ]),
    AuditsModule,
    MembershipsModule,
    ProfilesModule,
  ],
  controllers: [UsersController],
  providers: [InitialAdminSeedService, PasswordService, UsersService],
  exports: [InitialAdminSeedService, MongooseModule, PasswordService],
})
export class UsersModule {}
