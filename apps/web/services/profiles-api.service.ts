import { apiRequest } from './api';

export interface ApiProfile {
  id: string;
  name: string;
  description: string;
  status: 'activo' | 'inactivo';
  isSystem: boolean;
  permissions: Array<{ key: string; moduleKey: string; moduleName: string; action: string; name: string }>;
}

export interface PermissionModule {
  key: string;
  name: string;
  permissions: Array<{ key: string; name: string; action: string }>;
}

interface ApiResponse<T> { data: T; }

export async function getProfiles(): Promise<ApiProfile[]> {
  return (await apiRequest<ApiResponse<ApiProfile[]>>('/profiles', { credentials: 'include' })).data;
}

export async function getPermissionModules(): Promise<PermissionModule[]> {
  return (await apiRequest<ApiResponse<PermissionModule[]>>('/permissions', { credentials: 'include' })).data;
}

export async function createProfile(payload: { name: string; description: string; permissionKeys: string[] }): Promise<ApiProfile> {
  return (await apiRequest<ApiResponse<ApiProfile>>('/profiles', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  })).data;
}
