import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FindAlertsDto } from './alerts.dto';
import { AlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}
  @Get()
  @RequirePermissions('alertas.ver')
  async list(
    @Query() query: FindAlertsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.alerts.list(user, query),
      message: 'Alertas obtenidas correctamente.',
    };
  }
  @Get('unread-count')
  @RequirePermissions('alertas.ver')
  async count(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: { count: await this.alerts.count(user) },
      message: 'Conteo obtenido correctamente.',
    };
  }
  @Patch('read-all')
  @RequirePermissions('alertas.editar')
  async readAll(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: { updated: await this.alerts.readAll(user) },
      message: 'Alertas actualizadas correctamente.',
    };
  }
  @Get(':id')
  @RequirePermissions('alertas.ver')
  async detail(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.alerts.detail(user, id),
      message: 'Alerta obtenida correctamente.',
    };
  }
  @Patch(':id/read')
  @RequirePermissions('alertas.editar')
  async read(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.alerts.read(user, id),
      message: 'Alerta actualizada correctamente.',
    };
  }
}
