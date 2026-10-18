import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Reflector } from '@nestjs/core';
import type { Model } from 'mongoose';
import { Membership } from '../../memberships/schemas/membership.schema';
import { Profile } from '../../profiles/schemas/profile.schema';
import { Tenant } from '../../tenants/schemas/tenant.schema';
import { User } from '../../users/schemas/user.schema';
import { AuthConfigService } from '../auth.config';
import type { AuthenticatedRequest, JwtTokenPayload } from '../auth.types';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly authConfigService: AuthConfigService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<Membership>,
    @InjectModel(Profile.name) private readonly profileModel: Model<Profile>,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<Tenant>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const accessToken =
      request.cookies?.[this.authConfigService.accessTokenCookieName];

    if (!accessToken) {
      throw new UnauthorizedException('Debes iniciar sesión para continuar.');
    }

    const payload = await this.verifyAccessToken(accessToken);
    const user = await this.userModel
      .findOne({ _id: payload.sub, status: 'activo' })
      .select('_id name email platformProfileId')
      .lean();

    if (!user) {
      throw new UnauthorizedException('La sesión no es válida o expiró.');
    }

    if (payload.scope === 'platform') {
      const profile = await this.profileModel.exists({
        _id: user.platformProfileId,
        scope: 'platform',
        tenantId: null,
        status: 'activo',
      });

      if (
        !profile ||
        user.platformProfileId?.toString() !== payload.profileId
      ) {
        throw new UnauthorizedException(
          'La cuenta no tiene un perfil global activo.',
        );
      }

      request.user = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        scope: 'platform',
        profileId: payload.profileId,
      };

      return true;
    }

    if (!payload.tenantId || !payload.membershipId) {
      throw new UnauthorizedException('La sesión no es válida o expiró.');
    }

    const membership = await this.membershipModel
      .findOne({
        _id: payload.membershipId,
        userId: user._id,
        tenantId: payload.tenantId,
        status: 'activo',
      })
      .select('profileId')
      .lean();

    if (!membership) {
      throw new UnauthorizedException('La membresía no está activa.');
    }

    const [tenant, profile] = await Promise.all([
      this.tenantModel.exists({ _id: payload.tenantId, status: 'activo' }),
      this.profileModel.exists({
        _id: membership.profileId,
        scope: 'tenant',
        tenantId: payload.tenantId,
        status: 'activo',
      }),
    ]);

    if (!tenant || !profile) {
      throw new UnauthorizedException('La cuenta no tiene un perfil activo.');
    }

    request.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      scope: 'tenant',
      tenantId: payload.tenantId,
      membershipId: membership._id.toString(),
      profileId: membership.profileId.toString(),
    };

    return true;
  }

  private async verifyAccessToken(
    accessToken: string,
  ): Promise<JwtTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtTokenPayload>(accessToken, {
        secret: this.authConfigService.configuration.accessTokenSecret,
      });
    } catch {
      throw new UnauthorizedException('La sesión no es válida o expiró.');
    }
  }
}
