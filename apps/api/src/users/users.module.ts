import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProfilesModule } from '../profiles/profiles.module';
import { InitialAdminSeedService } from './initial-admin.seed.service';
import { PasswordService } from './password.service';
import { User, UserSchema } from './schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    ProfilesModule,
  ],
  providers: [InitialAdminSeedService, PasswordService],
  exports: [InitialAdminSeedService, MongooseModule, PasswordService],
})
export class UsersModule {}
