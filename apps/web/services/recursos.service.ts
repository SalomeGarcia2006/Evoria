import type {
  CreateResourceRequest,
  Resource,
  ResourceList,
  UpdateResourceRequest,
} from '@evoria/contracts';
import { apiRequest } from './api';

interface ApiResponse<T> {
  data: T;
  message: string;
}

export type ResourceItem = Resource;
export type CreateResourcePayload = CreateResourceRequest;
export type UpdateResourcePayload = UpdateResourceRequest;

export async function getResources(): Promise<ResourceList> {
  const response = await apiRequest<ApiResponse<ResourceList>>('/resources', {
    credentials: 'include',
  });
  return response.data;
}

export async function getResource(id: string): Promise<ResourceItem> {
  const response = await apiRequest<ApiResponse<ResourceItem>>(
    `/resources/${id}`,
    { credentials: 'include' },
  );
  return response.data;
}

export async function createResource(
  payload: CreateResourcePayload,
): Promise<ResourceItem> {
  const response = await apiRequest<ApiResponse<ResourceItem>>('/resources', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function updateResource(
  id: string,
  payload: UpdateResourcePayload,
): Promise<ResourceItem> {
  const response = await apiRequest<ApiResponse<ResourceItem>>(
    `/resources/${id}`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  return response.data;
}

export async function deactivateResource(id: string): Promise<ResourceItem> {
  const response = await apiRequest<ApiResponse<ResourceItem>>(
    `/resources/${id}`,
    { method: 'DELETE', credentials: 'include' },
  );
  return response.data;
}
