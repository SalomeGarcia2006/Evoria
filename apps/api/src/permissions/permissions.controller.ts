import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PermissionsService } from './permissions.service';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermissions('perfiles.ver')
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.permissionsService.findAll(user.scope),
      message: 'Permisos obtenidos correctamente.',
    };
  }
}
