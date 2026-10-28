import { apiRequest } from './api';

export const EVENT_STATUSES = [
  'borrador',
  'planificado',
  'en_progreso',
  'finalizado',
  'cancelado',
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

export interface EventItem {
  id: string;
  name: string;
  description: string | null;
  startAt: string;
  endAt: string;
  location: string | null;
  type: string | null;
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
  status?: EventStatus;
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

export async function cancelEvent(id: string): Promise<EventItem> {
  const response = await apiRequest<ApiResponse<EventItem>>(`/events/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  return response.data;
}
