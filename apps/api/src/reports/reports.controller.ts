import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ReportsService } from './reports.service';
import { ReportQuery } from './reports.dto';

@Controller('reports')
@RequirePermissions('reportes.ver')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  async summary(
    @Query() query: ReportQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.reports.summary(await this.reports.context(user), query),
      message: 'Resumen de reportes obtenido correctamente.',
    };
  }

  @Get('export/:kind')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @Param('kind') kind: string,
    @Query() query: ReportQuery,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const csv = await this.reports.csv(
      await this.reports.context(user),
      kind,
      query,
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte-${kind}.csv"`,
    );
    response.setHeader('Cache-Control', 'no-store');
    return csv;
  }

  @Get(':kind')
  async list(
    @Param('kind') kind: string,
    @Query() query: ReportQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.reports.report(
        await this.reports.context(user),
        kind,
        query,
      ),
      message: 'Reporte obtenido correctamente.',
    };
  }
}
