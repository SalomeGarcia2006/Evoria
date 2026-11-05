export const ALERT_TYPES = [
  'event_responsibility',
  'budget_pending',
  'budget_decided',
  'budget_limit',
  'inventory_low',
  'event_cancelled',
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];
export type AlertSeverity = 'info' | 'warning';
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
  type?: AlertType;
  severity?: AlertSeverity;
  eventId?: string;
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
