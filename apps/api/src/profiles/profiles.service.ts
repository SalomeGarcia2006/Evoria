import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model } from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Permission } from '../permissions/schemas/permission.schema';
import { FindProfilesDto } from './dto/find-profiles.dto';
import { Profile, type ProfileDocument } from './schemas/profile.schema';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectModel(Profile.name) private readonly profileModel: Model<Profile>,
    @InjectModel(Permission.name)
    private readonly permissionModel: Model<Permission>,
  ) {}

  async findAll(query: FindProfilesDto, currentUser: AuthenticatedUser) {
    const tenantId = this.getTenantId(currentUser);
    const profiles = await this.profileModel
      .find({
        tenantId,
        scope: 'tenant',
        ...(query.status ? { status: query.status } : {}),
      })
      .sort({ name: 1 });
    const permissionIds = profiles.flatMap((profile) => profile.permissionIds);
    const permissions = await this.permissionModel
      .find({ _id: { $in: permissionIds } })
      .sort({ moduleKey: 1, action: 1 });
    const permissionsById = new Map(
      permissions.map((permission) => [permission._id.toString(), permission]),
    );

    return profiles.map((profile) => this.toResponse(profile, permissionsById));
  }

  async findOne(id: string, currentUser: AuthenticatedUser) {
    const profile = await this.findProfile(id, this.getTenantId(currentUser));
    const permissions = await this.permissionModel
      .find({ _id: { $in: profile.permissionIds } })
      .sort({ moduleKey: 1, action: 1 });
    const permissionsById = new Map(
      permissions.map((permission) => [permission._id.toString(), permission]),
    );

    return this.toResponse(profile, permissionsById);
  }

  private getTenantId(user: AuthenticatedUser): string {
    if (user.scope !== 'tenant' || !user.tenantId) {
      throw new ForbiddenException('Esta acción requiere una empresa activa.');
    }

    return user.tenantId;
  }

  private async findProfile(
    id: string,
    tenantId: string,
  ): Promise<ProfileDocument> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException(
        'El identificador del perfil no es válido.',
      );
    }

    const profile = await this.profileModel.findOne({
      _id: id,
      tenantId,
      scope: 'tenant',
    });
    if (!profile) {
      throw new NotFoundException('El perfil no existe.');
    }

    return profile;
  }

  private toResponse(
    profile: ProfileDocument,
    permissionsById: Map<string, Permission>,
  ) {
    return {
      id: profile._id.toString(),
      name: profile.name,
      description: profile.description,
      status: profile.status,
      isSystem: profile.isSystem,
      permissions: profile.permissionIds.flatMap((permissionId) => {
        const permission = permissionsById.get(permissionId.toString());

        return permission
          ? [
              {
                key: permission.key,
                moduleKey: permission.moduleKey,
                moduleName: permission.moduleName,
                action: permission.action,
                name: permission.name,
              },
            ]
          : [];
      }),
    };
  }
}
