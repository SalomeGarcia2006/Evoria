import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MembershipsModule } from '../memberships/memberships.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { InitialAdminSeedService } from './initial-admin.seed.service';
import { PasswordService } from './password.service';
import { User, UserSchema } from './schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    MembershipsModule,
    ProfilesModule,
  ],
  providers: [InitialAdminSeedService, PasswordService],
  exports: [InitialAdminSeedService, MongooseModule, PasswordService],
})
export class UsersModule {}
