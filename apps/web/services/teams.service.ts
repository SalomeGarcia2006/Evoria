import { apiRequest } from './api';

export type TeamStatus = 'activo' | 'inactivo';

export type Team = {
  id: string;
  name: string;
  specialty: string;
  memberIds: string[];
  leaderId: string;
  status: TeamStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type TeamInput = {
  name: string;
  specialty: string;
  memberIds: string[];
  leaderId: string;
};

interface ApiResponse<T> {
  data: T;
}

export async function getTeams(): Promise<Team[]> {
  return (
    await apiRequest<ApiResponse<Team[]>>('/teams', { credentials: 'include' })
  ).data;
}

export async function createTeam(payload: TeamInput): Promise<Team> {
  return (
    await apiRequest<ApiResponse<Team>>('/teams', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function updateTeam(
  id: string,
  payload: Partial<TeamInput>,
): Promise<Team> {
  return (
    await apiRequest<ApiResponse<Team>>(`/teams/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  ).data;
}

export async function deactivateTeam(id: string): Promise<Team> {
  return (
    await apiRequest<ApiResponse<Team>>(`/teams/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
  ).data;
}

export async function getTeamSpecialties(): Promise<string[]> {
  return (
    await apiRequest<ApiResponse<string[]>>('/teams/specialties', {
      credentials: 'include',
    })
  ).data;
}

export async function createTeamSpecialty(
  name: string,
): Promise<{ id: string; name: string }> {
  return (
    await apiRequest<ApiResponse<{ id: string; name: string }>>(
      '/teams/specialties',
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      },
    )
  ).data;
}
