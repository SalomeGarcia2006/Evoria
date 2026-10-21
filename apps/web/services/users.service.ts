import { apiRequest } from './api';

export interface UserProfileOption {
  id: string;
  name: string;
  description: string | null;
}

export interface CompanyUser {
  id: string;
  membershipId: string;
  name: string;
  email: string;
  status: 'activo' | 'inactivo';
  profile: { id: string; name: string; description: string | null };
}

interface ApiResponse<T> {
  data: T;
}

export async function getUsers(): Promise<CompanyUser[]> {
  const firstPage = await apiRequest<
    ApiResponse<{
      items: CompanyUser[];
      pagination: { page: number; totalPages: number };
    }>
  >('/users?limit=100&page=1', { credentials: 'include' });
  const users = [...firstPage.data.items];
  for (let page = 2; page <= firstPage.data.pagination.totalPages; page += 1) {
    const response = await apiRequest<ApiResponse<{ items: CompanyUser[] }>>(
      `/users?limit=100&page=${page}`,
      { credentials: 'include' },
    );
    users.push(...response.data.items);
  }
  return users;
}

export async function getUserProfiles(): Promise<UserProfileOption[]> {
  const response = await apiRequest<ApiResponse<UserProfileOption[]>>(
    '/users/profiles',
    { credentials: 'include' },
  );
  return response.data;
}

export async function createUser(payload: {
  name: string;
  email: string;
  password: string;
  profileId: string;
}): Promise<CompanyUser> {
  const response = await apiRequest<ApiResponse<CompanyUser>>('/users', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function updateUser(
  id: string,
  payload: { profileId?: string; status?: 'activo' | 'inactivo' },
): Promise<CompanyUser> {
  const response = await apiRequest<ApiResponse<CompanyUser>>(`/users/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function deactivateUser(id: string): Promise<CompanyUser> {
  const response = await apiRequest<ApiResponse<CompanyUser>>(`/users/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return response.data;
}
