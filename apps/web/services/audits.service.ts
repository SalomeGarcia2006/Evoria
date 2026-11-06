import { apiRequest } from './api';

export interface AuditLogItem {
  id: string;
  userId: string;
  userName: string;
  module: string;
  action: string;
  entity: string;
  entityId: string;
  description: string;
  createdAt: string;
}

export interface AuditLogQuery {
  userId?: string;
  module?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogList {
  items: AuditLogItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ApiResponse<T> {
  data: T;
}

export async function getAuditLogs(
  query: AuditLogQuery = {},
): Promise<AuditLogList> {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') parameters.set(key, String(value));
  }
  const suffix = parameters.size ? `?${parameters}` : '';
  return (
    await apiRequest<ApiResponse<AuditLogList>>(`/audit-logs${suffix}`, {
      credentials: 'include',
      cache: 'no-store',
    })
  ).data;
}
