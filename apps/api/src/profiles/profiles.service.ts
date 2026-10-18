import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model } from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Membership } from '../memberships/schemas/membership.schema';
import {
  Permission,
  type PermissionDocument,
} from '../permissions/schemas/permission.schema';
import { CreateProfileDto } from './dto/create-profile.dto';
import { FindProfilesDto } from './dto/find-profiles.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Profile, type ProfileDocument } from './schemas/profile.schema';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectModel(Profile.name) private readonly profileModel: Model<Profile>,
    @InjectModel(Permission.name)
    private readonly permissionModel: Model<Permission>,
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<Membership>,
  ) {}

  async create(
    createProfileDto: CreateProfileDto,
    currentUser: AuthenticatedUser,
  ) {
    const tenantId = this.getTenantId(currentUser);
    const permissions = await this.findPermissions(
      createProfileDto.permissionKeys,
    );

    try {
      const profile = await this.profileModel.create({
        tenantId,
        scope: 'tenant',
        name: createProfileDto.name.trim(),
        description: createProfileDto.description.trim(),
        permissionIds: permissions.map((permission) => permission._id),
        isSystem: false,
      });

      return this.toResponse(profile, this.createPermissionsMap(permissions));
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('Ya existe un perfil con ese nombre.');
      }

      throw error;
    }
  }

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
    const permissionsById = await this.findPermissionsByIds(
      profile.permissionIds,
    );

    return this.toResponse(profile, permissionsById);
  }

  async update(
    id: string,
    updateProfileDto: UpdateProfileDto,
    currentUser: AuthenticatedUser,
  ) {
    const tenantId = this.getTenantId(currentUser);
    const profile = await this.findProfile(id, tenantId);
    this.assertModifiable(profile);

    if (
      updateProfileDto.name === undefined &&
      updateProfileDto.description === undefined &&
      updateProfileDto.permissionKeys === undefined
    ) {
      throw new BadRequestException('Debes indicar al menos un cambio.');
    }

    let permissionsById: Map<string, PermissionDocument>;
    if (updateProfileDto.permissionKeys) {
      const permissions = await this.findPermissions(
        updateProfileDto.permissionKeys,
      );
      profile.permissionIds = permissions.map((permission) => permission._id);
      permissionsById = this.createPermissionsMap(permissions);
    } else {
      permissionsById = await this.findPermissionsByIds(profile.permissionIds);
    }

    if (updateProfileDto.name !== undefined) {
      profile.name = updateProfileDto.name.trim();
    }
    if (updateProfileDto.description !== undefined) {
      profile.description = updateProfileDto.description.trim();
    }

    try {
      await profile.save();
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('Ya existe un perfil con ese nombre.');
      }

      throw error;
    }

    return this.toResponse(profile, permissionsById);
  }

  async deactivate(id: string, currentUser: AuthenticatedUser) {
    const tenantId = this.getTenantId(currentUser);
    const profile = await this.findProfile(id, tenantId);
    this.assertModifiable(profile);

    const hasActiveMemberships = await this.membershipModel.exists({
      tenantId,
      profileId: profile._id,
      status: 'activo',
    });
    if (hasActiveMemberships) {
      throw new ConflictException(
        'No puedes desactivar un perfil con usuarios activos asignados.',
      );
    }

    profile.status = 'inactivo';
    await profile.save();

    return this.toResponse(
      profile,
      await this.findPermissionsByIds(profile.permissionIds),
    );
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

  private async findPermissions(keys: string[]): Promise<PermissionDocument[]> {
    const permissions = await this.permissionModel
      .find({ key: { $in: keys }, scope: 'tenant', status: 'activo' })
      .sort({ moduleKey: 1, action: 1 });

    if (permissions.length !== keys.length) {
      throw new BadRequestException(
        'Uno o más permisos no pertenecen al catálogo activo de empresa.',
      );
    }

    return permissions;
  }

  private async findPermissionsByIds(permissionIds: Profile['permissionIds']) {
    const permissions = await this.permissionModel
      .find({ _id: { $in: permissionIds } })
      .sort({ moduleKey: 1, action: 1 });

    return this.createPermissionsMap(permissions);
  }

  private createPermissionsMap(permissions: PermissionDocument[]) {
    return new Map(
      permissions.map((permission) => [permission._id.toString(), permission]),
    );
  }

  private assertModifiable(profile: ProfileDocument): void {
    if (profile.isSystem) {
      throw new ForbiddenException(
        'Los perfiles del sistema no se pueden modificar.',
      );
    }
  }

  private toResponse(
    profile: ProfileDocument,
    permissionsById: Map<string, PermissionDocument>,
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

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    );
  }
}
