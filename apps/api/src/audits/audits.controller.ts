import { Controller, Get, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { FindAuditLogsDto } from './dto/find-audit-logs.dto';
import { AuditsService } from './audits.service';

@Controller('audit-logs')
export class AuditsController {
  constructor(private readonly auditsService: AuditsService) {}

  @Get()
  @RequirePermissions('auditoria.ver')
  async findAll(
    @Query() query: FindAuditLogsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.auditsService.findAll(query, user),
      message: 'Registros de auditoría obtenidos correctamente.',
    };
  }
}
