import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model, Types } from 'mongoose';
import {
  INITIAL_PERMISSIONS,
  LEGACY_PERMISSION_KEYS,
  TENANT_PERMISSION_KEYS,
} from '../permissions/permissions.constants';
import { Permission } from '../permissions/schemas/permission.schema';
import {
  ADMINISTRATOR_PROFILE_NAME,
  DEVELOPER_PROFILE_NAME,
} from './profiles.constants';
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
    await this.removeLegacyProfileNameIndex();
    await this.profileModel.updateMany(
      { tenantId: { $ne: null }, scope: { $exists: false } },
      { $set: { scope: 'tenant' } },
    );

    const permissionsResult = await this.permissionModel.bulkWrite(
      INITIAL_PERMISSIONS.map((permission) => ({
        updateOne: {
          filter: { key: permission.key },
          update: { $set: { ...permission, status: 'activo' } },
          upsert: true,
        },
      })),
    );

    await this.permissionModel.updateMany(
      { key: { $in: LEGACY_PERMISSION_KEYS } },
      { $set: { status: 'inactivo' } },
    );

    const [developerPermissionIds, tenantPermissionIds] = await Promise.all([
      this.findPermissionIds(
        INITIAL_PERMISSIONS.map((permission) => permission.key),
      ),
      this.findPermissionIds(TENANT_PERMISSION_KEYS),
    ]);

    await this.profileModel.updateMany(
      {
        name: ADMINISTRATOR_PROFILE_NAME,
        scope: 'tenant',
        isSystem: true,
      },
      { $set: { permissionIds: tenantPermissionIds } },
    );

    const profileResult = await this.profileModel.updateOne(
      { name: DEVELOPER_PROFILE_NAME, scope: 'platform', tenantId: null },
      {
        $set: {
          name: DEVELOPER_PROFILE_NAME,
          scope: 'platform',
          tenantId: null,
          description: 'Perfil global para administrar la plataforma.',
          permissionIds: developerPermissionIds,
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

  async createTenantAdministratorProfile(
    tenantId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<Types.ObjectId> {
    const permissions = await this.findPermissionIds(
      TENANT_PERMISSION_KEYS,
      session,
    );

    const profile = await this.profileModel
      .findOneAndUpdate(
        {
          name: ADMINISTRATOR_PROFILE_NAME,
          scope: 'tenant',
          tenantId,
        },
        {
          $set: {
            name: ADMINISTRATOR_PROFILE_NAME,
            scope: 'tenant',
            tenantId,
            description:
              'Perfil del sistema con gestión completa de la empresa.',
            permissionIds: permissions.map((permission) => permission._id),
            isSystem: true,
            status: 'activo',
          },
        },
        { upsert: true, new: true, session },
      )
      .select('_id')
      .lean();

    return profile._id;
  }

  private async findPermissionIds(
    keys: readonly string[],
    session?: ClientSession,
  ): Promise<Types.ObjectId[]> {
    const permissions = await this.permissionModel
      .find({ key: { $in: keys }, status: 'activo' })
      .select('_id')
      .session(session ?? null)
      .lean();

    if (permissions.length !== keys.length) {
      throw new Error(
        'Los permisos iniciales no existen. Ejecuta primero el seed de control de acceso.',
      );
    }

    return permissions.map((permission) => permission._id);
  }

  private async removeLegacyProfileNameIndex(): Promise<void> {
    let indexes: Awaited<
      ReturnType<typeof this.profileModel.collection.indexes>
    >;

    try {
      indexes = await this.profileModel.collection.indexes();
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 26
      ) {
        return;
      }

      throw error;
    }

    if (indexes.some((index) => index.name === 'name_1')) {
      await this.profileModel.collection.dropIndex('name_1');
    }
  }
}
