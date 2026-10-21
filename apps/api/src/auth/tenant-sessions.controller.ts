import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthConfigService } from './auth.config';
import { AuthService, type AuthTokens } from './auth.service';
import type { AuthenticatedUser } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { DeveloperOnly } from './decorators/developer-only.decorator';
import { PlatformOnly } from './decorators/platform-only.decorator';
import { RequirePermissions } from './decorators/require-permissions.decorator';
import { TenantsService } from '../tenants/tenants.service';

@Controller('tenants')
export class TenantSessionsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly authService: AuthService,
    private readonly authConfigService: AuthConfigService,
  ) {}

  @Post(':tenantId/join')
  @HttpCode(HttpStatus.OK)
  @PlatformOnly()
  @DeveloperOnly()
  @RequirePermissions('empresas.ver')
  async join(
    @Param('tenantId') tenantId: string,
    @CurrentUser() developer: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const membership = await this.tenantsService.join(tenantId, developer.id);
    const result = await this.authService.createTenantSession(
      developer.id,
      membership.id,
    );

    this.setAuthenticationCookies(response, result.tokens);

    return {
      data: result.session,
      message: 'Empresa seleccionada correctamente.',
    };
  }

  @Post('leave')
  @HttpCode(HttpStatus.OK)
  @DeveloperOnly()
  async leave(
    @CurrentUser() developer: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.tenantsService.leave(developer.id);
    const result = await this.authService.createPlatformSession(developer.id);

    this.setAuthenticationCookies(response, result.tokens);

    return {
      data: result.session,
      message: 'Saliste de la empresa correctamente.',
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
}
