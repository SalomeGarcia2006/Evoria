import { apiRequest } from './api';

export const SCHEDULE_STATUSES = [
  'pendiente',
  'en_progreso',
  'completado',
  'cancelado',
] as const;

export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export interface ScheduleItem {
  id: string;
  eventId: string;
  responsibleUserId: string | null;
  name: string;
  description: string | null;
  startAt: string;
  endAt: string;
  status: ScheduleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SchedulePayload {
  name: string;
  description?: string | null;
  startAt: string;
  endAt: string;
  responsibleUserId?: string | null;
  status: ScheduleStatus;
}

interface ApiResponse<T> {
  data: T;
}

export async function getSchedules(eventId: string): Promise<ScheduleItem[]> {
  return (
    await apiRequest<ApiResponse<ScheduleItem[]>>(
      `/events/${eventId}/schedules`,
      { credentials: 'include' },
    )
  ).data;
}

export async function createSchedule(
  eventId: string,
  payload: SchedulePayload,
): Promise<ScheduleItem> {
  return (
    await apiRequest<ApiResponse<ScheduleItem>>(
      `/events/${eventId}/schedules`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )
  ).data;
}

export async function updateSchedule(
  id: string,
  payload: SchedulePayload,
): Promise<ScheduleItem> {
  return (
    await apiRequest<ApiResponse<ScheduleItem>>(`/schedules/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function cancelSchedule(id: string): Promise<ScheduleItem> {
  return (
    await apiRequest<ApiResponse<ScheduleItem>>(`/schedules/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
  ).data;
}
