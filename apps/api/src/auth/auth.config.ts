import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JwtSignOptions } from '@nestjs/jwt';
import type { CookieOptions } from 'express';

const ACCESS_TOKEN_COOKIE_NAME = 'evoria_access_token';
const REFRESH_TOKEN_COOKIE_NAME = 'evoria_refresh_token';
const DURATION_PATTERN = /^(\d+)([smhd])$/;

type TokenDuration = NonNullable<JwtSignOptions['expiresIn']>;

interface ParsedDuration {
  value: TokenDuration;
  milliseconds: number;
}

export interface AuthConfiguration {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenDuration: ParsedDuration;
  refreshTokenDuration: ParsedDuration;
  cookieSecure: boolean;
}

@Injectable()
export class AuthConfigService {
  constructor(private readonly configService: ConfigService) {}

  get configuration(): AuthConfiguration {
    return {
      accessTokenSecret: this.getRequiredValue('JWT_ACCESS_SECRET'),
      refreshTokenSecret: this.getRequiredValue('JWT_REFRESH_SECRET'),
      accessTokenDuration: this.parseDuration('JWT_ACCESS_EXPIRES_IN', '2h'),
      refreshTokenDuration: this.parseDuration('JWT_REFRESH_EXPIRES_IN', '7d'),
      cookieSecure: this.configService.get<string>('COOKIE_SECURE') === 'true',
    };
  }

  get accessTokenCookieName(): string {
    return ACCESS_TOKEN_COOKIE_NAME;
  }

  get refreshTokenCookieName(): string {
    return REFRESH_TOKEN_COOKIE_NAME;
  }

  createCookieOptions(maxAge: number): CookieOptions {
    return {
      httpOnly: true,
      secure: this.configuration.cookieSecure,
      sameSite: 'lax',
      path: '/api',
      maxAge,
    };
  }

  private getRequiredValue(variableName: string): string {
    const value = this.configService.get<string>(variableName)?.trim();

    if (!value) {
      throw new Error(`${variableName} es obligatoria para la autenticación.`);
    }

    return value;
  }

  private parseDuration(
    variableName: string,
    defaultValue: string,
  ): ParsedDuration {
    const value = this.configService.get<string>(variableName, defaultValue);
    const match = DURATION_PATTERN.exec(value);

    if (!match) {
      throw new Error(
        `${variableName} debe usar el formato <número><s|m|h|d>, por ejemplo 2h.`,
      );
    }

    const amount = Number(match[1]);
    const unit = match[2];
    const unitInMilliseconds = {
      s: 1_000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    }[unit];

    if (!unitInMilliseconds) {
      throw new Error(`${variableName} contiene una unidad no válida.`);
    }

    return {
      value: value as TokenDuration,
      milliseconds: amount * unitInMilliseconds,
    };
  }
}
