import { apiRequest } from './api';

export type AlertSeverity = 'info' | 'warning';
export type AlertType =
  | 'event_responsibility'
  | 'budget_pending'
  | 'budget_decided'
  | 'budget_limit'
  | 'inventory_low'
  | 'event_cancelled';

export interface AlertItem {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  severity: AlertSeverity;
  eventId: string | null;
  requestId: string | null;
  inventoryItemId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface AlertQuery {
  page?: number;
  limit?: number;
  unread?: 'true' | 'false';
  severity?: AlertSeverity;
  type?: AlertType;
}

export interface AlertList {
  items: AlertItem[];
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

function queryString(query: AlertQuery): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') parameters.set(key, String(value));
  }
  return parameters.size ? `?${parameters}` : '';
}

export async function getAlerts(query: AlertQuery = {}): Promise<AlertList> {
  return (
    await apiRequest<ApiResponse<AlertList>>(`/alerts${queryString(query)}`, {
      credentials: 'include',
      cache: 'no-store',
    })
  ).data;
}

export async function getUnreadAlertCount(): Promise<number> {
  return (
    await apiRequest<ApiResponse<{ count: number }>>('/alerts/unread-count', {
      credentials: 'include',
      cache: 'no-store',
    })
  ).data.count;
}

export async function getAlert(id: string): Promise<AlertItem> {
  return (
    await apiRequest<ApiResponse<AlertItem>>(`/alerts/${id}`, {
      credentials: 'include',
      cache: 'no-store',
    })
  ).data;
}

export async function markAlertAsRead(id: string): Promise<AlertItem> {
  return (
    await apiRequest<ApiResponse<AlertItem>>(`/alerts/${id}/read`, {
      method: 'PATCH',
      credentials: 'include',
    })
  ).data;
}

export async function markAllAlertsAsRead(): Promise<number> {
  return (
    await apiRequest<ApiResponse<{ updated: number }>>('/alerts/read-all', {
      method: 'PATCH',
      credentials: 'include',
    })
  ).data.updated;
}
