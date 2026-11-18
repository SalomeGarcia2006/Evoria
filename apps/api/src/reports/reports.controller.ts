import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ReportsService } from './reports.service';
import { ExportReportQuery, ReportQuery } from './reports.dto';
import { ReportsPdfService } from './reports-pdf.service';

@Controller('reports')
@RequirePermissions('reportes.ver')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly pdf: ReportsPdfService,
  ) {}

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
  async exportFile(
    @Param('kind') kind: string,
    @Query() query: ExportReportQuery,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (query.format === 'pdf') {
      const pdf = await this.pdf.export(kind, query, user);
      response.setHeader('Cache-Control', 'private, no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      return new StreamableFile(pdf.buffer, {
        type: 'application/pdf',
        disposition: `attachment; filename="${pdf.filename}"`,
        length: pdf.buffer.length,
      });
    }
    if (query.teamId)
      throw new BadRequestException(
        'teamId solo se admite al exportar PDF de equipos.',
      );
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
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
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
