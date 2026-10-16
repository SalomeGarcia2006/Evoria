import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import type { Model, Types } from 'mongoose';
import { Permission } from '../permissions/schemas/permission.schema';
import { Profile } from '../profiles/schemas/profile.schema';
import { PasswordService } from '../users/password.service';
import { User } from '../users/schemas/user.schema';
import { AuthConfigService } from './auth.config';
import { LoginDto } from './dto/login.dto';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_IN_MILLISECONDS = 15 * 60 * 1_000;

interface AuthTokenPayload {
  sub: string;
  email: string;
}

type SessionUser = Pick<User, 'name' | 'email' | 'profileId' | 'status'> & {
  _id: Types.ObjectId;
};

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenMaxAge: number;
  refreshTokenMaxAge: number;
}

export interface AuthSession {
  user: {
    id: string;
    name: string;
    email: string;
    status: string;
  };
  profile: {
    id: string;
    name: string;
  };
  permissions: string[];
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
    @InjectModel(Profile.name) private readonly profileModel: Model<Profile>,
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

    const session = await this.createSession(user);
    const tokens = await this.createTokens({
      sub: user._id.toString(),
      email: user.email,
    });

    await this.userModel.updateOne(
      { _id: user._id },
      {
        $set: {
          loginAttempts: 0,
          lockedUntil: null,
          refreshTokenHash: this.passwordService.hash(tokens.refreshToken),
        },
      },
    );

    return {
      session,
      tokens,
    };
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

    const session = await this.createSession(user);
    const tokens = await this.createTokens({
      sub: user._id.toString(),
      email: user.email,
    });

    await this.userModel.updateOne(
      { _id: user._id },
      {
        $set: {
          refreshTokenHash: this.passwordService.hash(tokens.refreshToken),
        },
      },
    );

    return {
      session,
      tokens,
    };
  }

  private async createSession(user: SessionUser): Promise<AuthSession> {
    const profile = await this.profileModel
      .findOne({ _id: user.profileId, status: 'activo' })
      .lean();

    if (!profile) {
      throw new UnauthorizedException('La cuenta no tiene un perfil activo.');
    }

    const permissions = await this.permissionModel
      .find({ _id: { $in: profile.permissionIds }, status: 'activo' })
      .select('key')
      .lean();

    return {
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
      permissions: permissions.map((permission) => permission.key),
    };
  }

  private async createTokens(payload: AuthTokenPayload): Promise<AuthTokens> {
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
  ): Promise<AuthTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<AuthTokenPayload>(refreshToken, {
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
