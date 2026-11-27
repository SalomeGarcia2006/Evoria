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
  teamId: string | null;
  name: string;
  description: string | null;
  startAt: string;
  endAt: string;
  status: ScheduleStatus;
  createdAt: string;
  updatedAt: string;
}

export type AvailableTeam = {
  id: string;
  name: string;
  specialty: string;
  leaderId: string;
};
export type TeamHistoryEntry = {
  id: string;
  teamId: string;
  action: 'asignado' | 'retirado' | 'completado';
  actorId: string | null;
  actorName: string;
  createdAt: string;
};

export interface SchedulePayload {
  name: string;
  description?: string | null;
  startAt: string;
  endAt: string;
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

export async function getAvailableTeams(id: string): Promise<AvailableTeam[]> {
  return (
    await apiRequest<ApiResponse<AvailableTeam[]>>(
      `/schedules/${encodeURIComponent(id)}/available-teams`,
      { credentials: 'include', cache: 'no-store' },
    )
  ).data;
}
export async function assignScheduleTeam(id: string, teamId: string) {
  return (
    await apiRequest<ApiResponse<{ scheduleId: string; teamId: string }>>(
      `/schedules/${encodeURIComponent(id)}/team`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      },
    )
  ).data;
}
export async function removeScheduleTeam(id: string) {
  return (
    await apiRequest<ApiResponse<{ scheduleId: string; teamId: null }>>(
      `/schedules/${encodeURIComponent(id)}/team`,
      { method: 'DELETE', credentials: 'include' },
    )
  ).data;
}
export async function completeSchedule(id: string) {
  return (
    await apiRequest<ApiResponse<{ scheduleId: string; status: 'completado' }>>(
      `/schedules/${encodeURIComponent(id)}/complete`,
      { method: 'POST', credentials: 'include' },
    )
  ).data;
}
export async function getScheduleTeamHistory(
  id: string,
): Promise<TeamHistoryEntry[]> {
  return (
    await apiRequest<ApiResponse<TeamHistoryEntry[]>>(
      `/schedules/${encodeURIComponent(id)}/team-history`,
      { credentials: 'include', cache: 'no-store' },
    )
  ).data;
}
