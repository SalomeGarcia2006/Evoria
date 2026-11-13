import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthConfigService } from './auth.config';
import { AuthService, type AuthTokens } from './auth.service';
import { CaptchaService } from './captcha.service';
import type { AuthenticatedUser } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { CaptchaDto } from './dto/captcha.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { LoginDto } from './dto/login.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { VerifyPasswordResetDto } from './dto/verify-password-reset.dto';
import { GoogleChangeCodeDto } from './dto/google-change-code.dto';
import { GoogleOAuthService } from './google-oauth.service';
import { PasswordResetService } from './password-reset.service';

const GOOGLE_STATE_COOKIE = 'evoria_google_state';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authConfigService: AuthConfigService,
    private readonly captchaService: CaptchaService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.captchaService.verify(loginDto.captchaToken);
    const result = await this.authService.login(loginDto);

    this.setAuthenticationCookies(response, result.tokens);

    return {
      data: result.session,
      message: 'Inicio de sesión realizado correctamente.',
    };
  }

  @Post('password-reset/request')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async requestPasswordReset(@Body() body: RequestPasswordResetDto) {
    await this.passwordResetService.request(body.email);
    return {
      data: null,
      message: 'Si el correo existe, recibirás un código de recuperación.',
    };
  }

  @Post('password-reset/verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyPasswordReset(@Body() body: VerifyPasswordResetDto) {
    await this.passwordResetService.verify(body.email, body.code);
    return { data: null, message: 'Código válido.' };
  }

  @Post('password-reset/confirm')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async confirmPasswordReset(@Body() body: ConfirmPasswordResetDto) {
    await this.passwordResetService.confirm(
      body.email,
      body.code,
      body.newPassword,
    );
    return { data: null, message: 'Contraseña actualizada correctamente.' };
  }

  @Get('google/connection')
  async googleConnection(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.googleOAuthService.connection(user.id),
      message: 'Vinculación de Google obtenida correctamente.',
    };
  }

  @Post('google/link')
  @HttpCode(HttpStatus.OK)
  async startGoogleLink(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.googleOAuthService.startLink(
      user,
      request.cookies?.[this.authConfigService.accessTokenCookieName],
    );
    this.setGoogleStateCookie(response, result.state);
    return { data: { url: result.url }, message: 'Vinculación iniciada.' };
  }

  @Post('google/change/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async requestGoogleChange(@CurrentUser() user: AuthenticatedUser) {
    await this.googleOAuthService.requestChange(user.id);
    return {
      data: null,
      message: 'Código enviado al correo de Google vinculado.',
    };
  }

  @Post('google/change/confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  async confirmGoogleChange(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GoogleChangeCodeDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.googleOAuthService.confirmChange(
      user,
      request.cookies?.[this.authConfigService.accessTokenCookieName],
      body.code,
    );
    this.setGoogleStateCookie(response, result.state);
    return { data: { url: result.url }, message: 'Código confirmado.' };
  }

  @Post('google/login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async startGoogleLogin(
    @Body() body: CaptchaDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.googleOAuthService.startLogin(body.captchaToken);
    this.setGoogleStateCookie(response, result.state);
    return {
      data: { url: result.url },
      message: 'Inicio con Google iniciado.',
    };
  }

  @Get('google/callback')
  @Public()
  async googleCallback(
    @Query('state') state: string | undefined,
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const stateCookie = request.cookies?.[GOOGLE_STATE_COOKIE];
    response.clearCookie(
      GOOGLE_STATE_COOKIE,
      this.authConfigService.createClearCookieOptions(),
    );
    const webOrigin = process.env.WEB_ORIGIN?.trim() || 'http://localhost:3000';
    try {
      const result = await this.googleOAuthService.complete(
        state,
        stateCookie,
        code,
        error,
        request.cookies?.[this.authConfigService.accessTokenCookieName],
      );
      if (result.loginResult) {
        this.setAuthenticationCookies(response, result.loginResult.tokens);
      }
      const path =
        result.mode !== 'login'
          ? `/mi-perfil?google=${result.status}`
          : `/login?google=${result.status}`;
      return response.redirect(new URL(path, webOrigin).toString());
    } catch {
      return response.redirect(
        new URL('/login?google=error', webOrigin).toString(),
      );
    }
  }

  @Post('refresh')
  @Public()
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
  @Public()
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

  @Get('me')
  async currentSession(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.authService.getSession(
        user.id,
        user.scope,
        user.membershipId,
      ),
      message: 'Sesión obtenida correctamente.',
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

  private setGoogleStateCookie(response: Response, state: string): void {
    response.cookie(
      GOOGLE_STATE_COOKIE,
      state,
      this.authConfigService.createCookieOptions(5 * 60_000),
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
