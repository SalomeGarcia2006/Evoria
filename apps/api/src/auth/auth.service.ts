import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import type { AuthSession } from '@evoria/contracts';
import { randomUUID } from 'node:crypto';
import type { Model, Types } from 'mongoose';
import { Membership } from '../memberships/schemas/membership.schema';
import { Permission } from '../permissions/schemas/permission.schema';
import { Profile } from '../profiles/schemas/profile.schema';
import { Tenant } from '../tenants/schemas/tenant.schema';
import { PasswordService } from '../users/password.service';
import { User } from '../users/schemas/user.schema';
import { AuthConfigService } from './auth.config';
import type { JwtTokenPayload } from './auth.types';
import { LoginDto } from './dto/login.dto';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_IN_MILLISECONDS = 15 * 60 * 1_000;

type SessionUser = Pick<
  User,
  'name' | 'email' | 'status' | 'platformProfileId'
> & {
  _id: Types.ObjectId;
};

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenMaxAge: number;
  refreshTokenMaxAge: number;
}

export interface LoginResult {
  session: AuthSession;
  tokens: AuthTokens;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authConfigService: AuthConfigService,
    private readonly passwordService: PasswordService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<Membership>,
    @InjectModel(Profile.name) private readonly profileModel: Model<Profile>,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<Tenant>,
    @InjectModel(Permission.name)
    private readonly permissionModel: Model<Permission>,
  ) {}

  async login(loginDto: LoginDto): Promise<LoginResult> {
    const email = loginDto.email.toLowerCase();
    const user = await this.userModel
      .findOne({ email })
      .select('+passwordHash')
      .lean();

    if (!user || user.status !== 'activo') {
      throw new UnauthorizedException('Correo o contraseña inválidos.');
    }

    const now = new Date();

    if (user.lockedUntil && user.lockedUntil > now) {
      throw new UnauthorizedException(
        'La cuenta está bloqueada temporalmente. Intenta más tarde.',
      );
    }

    if (!this.passwordService.verify(loginDto.password, user.passwordHash)) {
      await this.registerFailedAttempt(
        user._id,
        user.loginAttempts,
        user.lockedUntil,
      );
      throw new UnauthorizedException('Correo o contraseña inválidos.');
    }

    return this.createLoginResult(user, undefined, undefined, true);
  }

  async refresh(refreshToken?: string): Promise<LoginResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('La sesión no es válida o expiró.');
    }

    const payload = await this.verifyRefreshToken(refreshToken);
    const user = await this.userModel
      .findById(payload.sub)
      .select('+refreshTokenHash')
      .lean();

    if (
      !user ||
      user.status !== 'activo' ||
      !user.refreshTokenHash ||
      !this.passwordService.verify(refreshToken, user.refreshTokenHash)
    ) {
      throw new UnauthorizedException('La sesión no es válida o expiró.');
    }

    return this.createLoginResult(user, payload.scope, payload.membershipId);
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    let payload: JwtTokenPayload;

    try {
      payload = await this.verifyRefreshToken(refreshToken);
    } catch {
      return;
    }

    const user = await this.userModel
      .findById(payload.sub)
      .select('+refreshTokenHash')
      .lean();

    if (
      !user?.refreshTokenHash ||
      !this.passwordService.verify(refreshToken, user.refreshTokenHash)
    ) {
      return;
    }

    await this.userModel.updateOne(
      { _id: user._id, refreshTokenHash: user.refreshTokenHash },
      { $set: { refreshTokenHash: null } },
    );
  }

  async getSession(
    userId: string,
    scope: JwtTokenPayload['scope'],
    membershipId?: string,
  ): Promise<AuthSession> {
    const user = await this.userModel
      .findOne({ _id: userId, status: 'activo' })
      .lean();

    if (!user) {
      throw new UnauthorizedException('La sesión no es válida o expiró.');
    }

    return this.createSession(user, scope, membershipId);
  }

  async createTenantSession(
    userId: string,
    membershipId: string,
  ): Promise<LoginResult> {
    const user = await this.findActiveUser(userId);

    return this.createLoginResult(user, 'tenant', membershipId);
  }

  async createPlatformSession(userId: string): Promise<LoginResult> {
    const user = await this.findActiveUser(userId);

    return this.createLoginResult(user, 'platform');
  }

  private async createSession(
    user: SessionUser,
    scope?: JwtTokenPayload['scope'],
    membershipId?: string,
  ): Promise<AuthSession> {
    const sessionScope =
      scope ?? (user.platformProfileId ? 'platform' : 'tenant');

    if (sessionScope === 'platform') {
      const profile = await this.profileModel
        .findOne({
          _id: user.platformProfileId,
          scope: 'platform',
          tenantId: null,
          status: 'activo',
        })
        .lean();

      if (!profile) {
        throw new UnauthorizedException(
          'La cuenta no tiene un perfil global activo.',
        );
      }

      const permissions = await this.permissionModel
        .find({ _id: { $in: profile.permissionIds }, status: 'activo' })
        .select('key')
        .lean();

      return {
        scope: 'platform',
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          status: user.status,
        },
        profile: { id: profile._id.toString(), name: profile.name },
        permissions: permissions.map((permission) => permission.key),
      };
    }

    const membership = await this.membershipModel
      .findOne({
        userId: user._id,
        status: 'activo',
        ...(membershipId ? { _id: membershipId } : {}),
      })
      .sort({ createdAt: 1 })
      .lean();

    if (!membership) {
      throw new UnauthorizedException(
        'La cuenta no pertenece a una empresa activa.',
      );
    }

    const [tenant, profile] = await Promise.all([
      this.tenantModel
        .findOne({ _id: membership.tenantId, status: 'activo' })
        .lean(),
      this.profileModel
        .findOne({
          _id: membership.profileId,
          scope: 'tenant',
          tenantId: membership.tenantId,
          status: 'activo',
        })
        .lean(),
    ]);

    if (!tenant || !profile) {
      throw new UnauthorizedException('La cuenta no tiene un perfil activo.');
    }

    const permissions = await this.permissionModel
      .find({ _id: { $in: profile.permissionIds }, status: 'activo' })
      .select('key')
      .lean();

    return {
      scope: 'tenant',
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        status: user.status,
      },
      profile: {
        id: profile._id.toString(),
        name: profile.name,
      },
      tenant: {
        id: tenant._id.toString(),
        name: tenant.name,
        slug: tenant.slug,
      },
      membership: {
        id: membership._id.toString(),
      },
      permissions: permissions.map((permission) => permission.key),
    };
  }

  private async createLoginResult(
    user: SessionUser,
    scope?: JwtTokenPayload['scope'],
    membershipId?: string,
    resetLoginAttempts = false,
  ): Promise<LoginResult> {
    const session = await this.createSession(user, scope, membershipId);
    const tokens = await this.createTokens({
      sub: user._id.toString(),
      email: user.email,
      scope: session.scope,
      profileId: session.profile.id,
      ...(session.tenant ? { tenantId: session.tenant.id } : {}),
      ...(session.membership ? { membershipId: session.membership.id } : {}),
    });

    await this.userModel.updateOne(
      { _id: user._id },
      {
        $set: {
          ...(resetLoginAttempts
            ? { loginAttempts: 0, lockedUntil: null }
            : {}),
          refreshTokenHash: this.passwordService.hash(tokens.refreshToken),
        },
      },
    );

    return { session, tokens };
  }

  private async findActiveUser(userId: string): Promise<SessionUser> {
    const user = await this.userModel
      .findOne({ _id: userId, status: 'activo' })
      .lean();

    if (!user) {
      throw new UnauthorizedException('La sesión no es válida o expiró.');
    }

    return user;
  }

  private async createTokens(payload: JwtTokenPayload): Promise<AuthTokens> {
    const configuration = this.authConfigService.configuration;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, jti: randomUUID() },
        {
          secret: configuration.accessTokenSecret,
          expiresIn: configuration.accessTokenDuration.value,
        },
      ),
      this.jwtService.signAsync(
        { ...payload, jti: randomUUID() },
        {
          secret: configuration.refreshTokenSecret,
          expiresIn: configuration.refreshTokenDuration.value,
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      accessTokenMaxAge: configuration.accessTokenDuration.milliseconds,
      refreshTokenMaxAge: configuration.refreshTokenDuration.milliseconds,
    };
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<JwtTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtTokenPayload>(refreshToken, {
        secret: this.authConfigService.configuration.refreshTokenSecret,
      });
    } catch {
      throw new UnauthorizedException('La sesión no es válida o expiró.');
    }
  }

  private async registerFailedAttempt(
    userId: Types.ObjectId,
    loginAttempts: number,
    lockedUntil: Date | null,
  ): Promise<void> {
    const isPreviousLockExpired = lockedUntil && lockedUntil <= new Date();
    const nextAttempts = (isPreviousLockExpired ? 0 : loginAttempts) + 1;
    const nextLockedUntil =
      nextAttempts >= MAX_LOGIN_ATTEMPTS
        ? new Date(Date.now() + LOCK_DURATION_IN_MILLISECONDS)
        : null;

    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          loginAttempts: nextAttempts,
          lockedUntil: nextLockedUntil,
        },
      },
    );
  }
}
