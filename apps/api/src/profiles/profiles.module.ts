import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PermissionsModule } from '../permissions/permissions.module';
import { AccessControlSeedService } from './access-control.seed.service';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { Profile, ProfileSchema } from './schemas/profile.schema';

@Module({
  imports: [
    PermissionsModule,
    MongooseModule.forFeature([{ name: Profile.name, schema: ProfileSchema }]),
  ],
  controllers: [ProfilesController],
  providers: [AccessControlSeedService, ProfilesService],
  exports: [AccessControlSeedService, MongooseModule],
})
export class ProfilesModule {}
