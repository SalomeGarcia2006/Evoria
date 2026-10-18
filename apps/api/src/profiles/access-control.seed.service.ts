import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, Types } from 'mongoose';
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

  async seed(tenantId: Types.ObjectId): Promise<AccessControlSeedResult> {
    await this.removeLegacyProfileNameIndex();

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

    await this.profileModel.updateOne(
      {
        name: ADMINISTRATOR_PROFILE_NAME,
        tenantId: { $exists: false },
      },
      { $set: { tenantId } },
    );

    const profileResult = await this.profileModel.updateOne(
      { name: ADMINISTRATOR_PROFILE_NAME, tenantId },
      {
        $set: {
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

  private async removeLegacyProfileNameIndex(): Promise<void> {
    const indexes = await this.profileModel.collection.indexes();

    if (indexes.some((index) => index.name === 'name_1')) {
      await this.profileModel.collection.dropIndex('name_1');
    }
  }
}
