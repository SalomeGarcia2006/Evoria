import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MembershipsModule } from '../memberships/memberships.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { InitialAdminSeedService } from './initial-admin.seed.service';
import { PasswordService } from './password.service';
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    MembershipsModule,
    ProfilesModule,
  ],
  controllers: [UsersController],
  providers: [InitialAdminSeedService, PasswordService, UsersService],
  exports: [InitialAdminSeedService, MongooseModule, PasswordService],
})
export class UsersModule {}
