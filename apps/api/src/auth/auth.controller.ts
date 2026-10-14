import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthConfigService } from './auth.config';
import { AuthService } from './auth.service';
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

    response.cookie(
      this.authConfigService.accessTokenCookieName,
      result.tokens.accessToken,
      this.authConfigService.createCookieOptions(
        result.tokens.accessTokenMaxAge,
      ),
    );
    response.cookie(
      this.authConfigService.refreshTokenCookieName,
      result.tokens.refreshToken,
      this.authConfigService.createCookieOptions(
        result.tokens.refreshTokenMaxAge,
      ),
    );

    return {
      data: result.session,
      message: 'Inicio de sesión realizado correctamente.',
    };
  }
}
