import { Controller, Get } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @RequirePermissions('dashboard.ver')
  async summary(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.dashboardService.summary(user),
      message: 'Resumen del dashboard obtenido correctamente.',
    };
  }
}
