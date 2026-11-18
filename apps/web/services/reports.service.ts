import type {
  BudgetReport,
  EventReport,
  InventoryReport,
  PdfReportKind,
  ReportExportQuery,
  ReportKind,
  ReportQuery,
  ReportsSummary,
} from '@evoria/contracts';
import { apiRequest, apiUrl } from './api';

export type ReportData =
  | EventReport
  | BudgetReport
  | InventoryReport
  | {
      items: Array<Record<string, unknown>>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    };

function queryString(query: ReportQuery = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export async function getReportsSummary(query: ReportQuery = {}) {
  const response = await apiRequest<{ data: ReportsSummary }>(
    `/reports/summary${queryString(query)}`,
    { credentials: 'include', cache: 'no-store' },
  );
  return response.data;
}

export async function getReport(kind: ReportKind, query: ReportQuery = {}) {
  const response = await apiRequest<{ data: ReportData }>(
    `/reports/${kind}${queryString(query)}`,
    { credentials: 'include', cache: 'no-store' },
  );
  return response.data;
}

export async function downloadPdfReport(
  kind: PdfReportKind,
  query: ReportExportQuery = {},
) {
  const exportQuery = { ...query, format: 'pdf' as const };
  const response = await fetch(
    `${apiUrl}/reports/export/${kind}${queryString(exportQuery)}`,
    { credentials: 'include', cache: 'no-store' },
  );
  if (!response.ok) throw new Error('No se pudo exportar el reporte.');
  return response.blob();
}
