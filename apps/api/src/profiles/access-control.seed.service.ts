import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { INITIAL_PERMISSIONS } from '../permissions/permissions.constants';
import { Permission } from '../permissions/schemas/permission.schema';
import { ADMINISTRATOR_PROFILE_NAME } from './profiles.constants';
import { Profile } from './schemas/profile.schema';

export interface AccessControlSeedResult {
  permissionsCreated: number;
  permissionsExisting: number;
  profilesCreated: number;
  profilesExisting: number;
}

@Injectable()
export class AccessControlSeedService {
  constructor(
    @InjectModel(Permission.name)
    private readonly permissionModel: Model<Permission>,
    @InjectModel(Profile.name) private readonly profileModel: Model<Profile>,
  ) {}

  async seed(): Promise<AccessControlSeedResult> {
    const permissionsResult = await this.permissionModel.bulkWrite(
      INITIAL_PERMISSIONS.map((permission) => ({
        updateOne: {
          filter: { key: permission.key },
          update: { $setOnInsert: permission },
          upsert: true,
        },
      })),
    );

    const permissions = await this.permissionModel
      .find({ key: { $in: INITIAL_PERMISSIONS.map(({ key }) => key) } })
      .select('_id')
      .lean();

    const profileResult = await this.profileModel.updateOne(
      { name: ADMINISTRATOR_PROFILE_NAME },
      {
        $setOnInsert: {
          name: ADMINISTRATOR_PROFILE_NAME,
          description: 'Perfil del sistema con gestión completa de acceso.',
          permissionIds: permissions.map((permission) => permission._id),
          isSystem: true,
        },
      },
      { upsert: true },
    );

    return {
      permissionsCreated: permissionsResult.upsertedCount,
      permissionsExisting:
        INITIAL_PERMISSIONS.length - permissionsResult.upsertedCount,
      profilesCreated: profileResult.upsertedCount,
      profilesExisting: profileResult.upsertedCount ? 0 : 1,
    };
  }
}
