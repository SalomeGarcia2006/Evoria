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
import { DEVELOPER_PROFILE_NAME } from '../../profiles/profiles.constants';
import { Profile } from '../../profiles/schemas/profile.schema';
import { User } from '../../users/schemas/user.schema';
import type { AuthenticatedRequest } from '../auth.types';
import { DEVELOPER_ONLY_KEY } from '../decorators/developer-only.decorator';

@Injectable()
export class DeveloperGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Profile.name) private readonly profileModel: Model<Profile>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const developerOnly = this.reflector.getAllAndOverride<boolean>(
      DEVELOPER_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!developerOnly) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new UnauthorizedException('Debes iniciar sesión para continuar.');
    }

    const user = await this.userModel
      .findOne({ _id: request.user.id, status: 'activo' })
      .select('platformProfileId')
      .lean();

    const profile = user?.platformProfileId
      ? await this.profileModel.exists({
          _id: user.platformProfileId,
          name: DEVELOPER_PROFILE_NAME,
          scope: 'platform',
          tenantId: null,
          status: 'activo',
        })
      : null;

    if (!profile) {
      throw new ForbiddenException(
        'Esta acción requiere una cuenta de desarrollador.',
      );
    }

    return true;
  }
}
