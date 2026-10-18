import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Permission } from '../../permissions/schemas/permission.schema';
import { Profile } from '../../profiles/schemas/profile.schema';
import type { AuthenticatedRequest } from '../auth.types';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectModel(Profile.name) private readonly profileModel: Model<Profile>,
    @InjectModel(Permission.name)
    private readonly permissionModel: Model<Permission>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new UnauthorizedException('Debes iniciar sesión para continuar.');
    }

    const profile = await this.profileModel
      .findOne({
        _id: request.user.profileId,
        scope: request.user.scope,
        ...(request.user.scope === 'tenant'
          ? { tenantId: request.user.tenantId }
          : { tenantId: null }),
        status: 'activo',
      })
      .select('permissionIds')
      .lean();

    if (!profile) {
      throw new ForbiddenException('Tu perfil no está disponible.');
    }

    const permissions = await this.permissionModel
      .find({ _id: { $in: profile.permissionIds }, status: 'activo' })
      .select('key')
      .lean();
    const grantedPermissions = new Set(
      permissions.map((permission) => permission.key),
    );
    const hasAllPermissions = requiredPermissions.every((permission) =>
      grantedPermissions.has(permission),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        'No tienes permisos para realizar esta acción.',
      );
    }

    return true;
  }
}
