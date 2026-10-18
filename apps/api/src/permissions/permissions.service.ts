import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Permission } from './schemas/permission.schema';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectModel(Permission.name)
    private readonly permissionModel: Model<Permission>,
  ) {}

  async findAll(scope: 'platform' | 'tenant') {
    const permissions = await this.permissionModel
      .find({ status: 'activo', scope })
      .sort({ scope: 1, moduleKey: 1, action: 1 })
      .lean();
    const modules = new Map<
      string,
      {
        key: string;
        name: string;
        description: string;
        scope: 'platform' | 'tenant';
        permissions: { key: string; name: string; action: string }[];
      }
    >();

    for (const permission of permissions) {
      const module = modules.get(permission.moduleKey) ?? {
        key: permission.moduleKey,
        name: permission.moduleName,
        description: permission.moduleDescription,
        scope: permission.scope,
        permissions: [],
      };

      module.permissions.push({
        key: permission.key,
        name: permission.name,
        action: permission.action,
      });
      modules.set(permission.moduleKey, module);
    }

    return [...modules.values()];
  }
}
