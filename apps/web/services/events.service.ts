import { apiRequest } from './api';

export const EVENT_STATUSES = [
  'borrador',
  'planificado',
  'en_progreso',
  'finalizado',
  'cancelado',
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

export const ACTIVE_EVENT_STATUSES: readonly EventStatus[] = [
  'borrador',
  'planificado',
  'en_progreso',
];

export function isActiveEvent(status: string) {
  return ACTIVE_EVENT_STATUSES.some((activeStatus) => activeStatus === status);
}

export interface EventItem {
  id: string;
  name: string;
  description: string | null;
  startAt: string;
  endAt: string;
  location: string | null;
  type: string | null;
  baseBudget: number;
  status: EventStatus;
  responsibleUserId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventPayload {
  name: string;
  description?: string;
  startAt: string;
  endAt: string;
  location?: string;
  type?: string;
  baseBudget: number;
  status?: EventStatus;
  responsibleUserId?: string;
}

interface ApiResponse<T> {
  data: T;
  message: string;
}

interface EventList {
  items: EventItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function getEvents(): Promise<EventList> {
  const response = await apiRequest<ApiResponse<EventList>>('/events', {
    credentials: 'include',
  });
  return response.data;
}

export async function getAllEvents(): Promise<EventItem[]> {
  const firstPage = await apiRequest<ApiResponse<EventList>>(
    '/events?limit=100&page=1',
    { credentials: 'include' },
  );
  const events = [...firstPage.data.items];

  for (let page = 2; page <= firstPage.data.pagination.totalPages; page += 1) {
    const response = await apiRequest<ApiResponse<EventList>>(
      `/events?limit=100&page=${page}`,
      { credentials: 'include' },
    );
    events.push(...response.data.items);
  }

  return events;
}

export async function getEvent(id: string): Promise<EventItem> {
  const response = await apiRequest<ApiResponse<EventItem>>(`/events/${id}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  return response.data;
}

export async function createEvent(
  payload: CreateEventPayload,
): Promise<EventItem> {
  const response = await apiRequest<ApiResponse<EventItem>>('/events', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function updateEventStatus(
  id: string,
  status: EventStatus,
): Promise<EventItem> {
  const response = await apiRequest<ApiResponse<EventItem>>(`/events/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  return response.data;
}

export async function cancelEvent(id: string): Promise<EventItem> {
  const response = await apiRequest<ApiResponse<EventItem>>(`/events/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  return response.data;
}
