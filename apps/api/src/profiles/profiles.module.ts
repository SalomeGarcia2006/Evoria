import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PermissionsModule } from '../permissions/permissions.module';
import { AccessControlSeedService } from './access-control.seed.service';
import { Profile, ProfileSchema } from './schemas/profile.schema';

@Module({
  imports: [
    PermissionsModule,
    MongooseModule.forFeature([{ name: Profile.name, schema: ProfileSchema }]),
  ],
  providers: [AccessControlSeedService],
  exports: [AccessControlSeedService, MongooseModule],
})
export class ProfilesModule {}
