import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthConfigService } from './auth.config';
import { AuthService, type AuthTokens } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authConfigService: AuthConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto);

    this.setAuthenticationCookies(response, result.tokens);

    return {
      data: result.session,
      message: 'Inicio de sesión realizado correctamente.',
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.refresh(
      request.cookies?.[this.authConfigService.refreshTokenCookieName],
    );

    this.setAuthenticationCookies(response, result.tokens);

    return {
      data: result.session,
      message: 'Sesión renovada correctamente.',
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(
      request.cookies?.[this.authConfigService.refreshTokenCookieName],
    );

    this.clearAuthenticationCookies(response);

    return {
      data: null,
      message: 'Sesión cerrada correctamente.',
    };
  }

  private setAuthenticationCookies(
    response: Response,
    tokens: AuthTokens,
  ): void {
    response.cookie(
      this.authConfigService.accessTokenCookieName,
      tokens.accessToken,
      this.authConfigService.createCookieOptions(tokens.accessTokenMaxAge),
    );
    response.cookie(
      this.authConfigService.refreshTokenCookieName,
      tokens.refreshToken,
      this.authConfigService.createCookieOptions(tokens.refreshTokenMaxAge),
    );
  }

  private clearAuthenticationCookies(response: Response): void {
    const cookieOptions = this.authConfigService.createClearCookieOptions();

    response.clearCookie(
      this.authConfigService.accessTokenCookieName,
      cookieOptions,
    );
    response.clearCookie(
      this.authConfigService.refreshTokenCookieName,
      cookieOptions,
    );
  }
}
