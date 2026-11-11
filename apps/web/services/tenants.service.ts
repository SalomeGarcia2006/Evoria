import { apiRequest } from './api';

export interface TenantOption {
  id: string;
  name: string;
  nit: string;
  slug: string;
  status: 'activo' | 'inactivo';
}

export async function getTenants(): Promise<TenantOption[]> {
  const response = await apiRequest<{ data: TenantOption[] }>('/tenants', {
    credentials: 'include',
    cache: 'no-store',
  });
  return response.data;
}

export interface CreateTenantPayload {
  name: string;
  nit: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
}

export interface CreatedTenant {
  id: string;
  name: string;
  nit: string;
  slug: string;
  administrator: {
    id: string;
    name: string;
    email: string;
    membershipId: string;
  };
}

export async function createTenant(
  payload: CreateTenantPayload,
): Promise<CreatedTenant> {
  const response = await apiRequest<{ data: CreatedTenant }>('/tenants', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return response.data;
}

export type TenantOperationMode = 'propios' | 'clientes' | 'ambos';
export type TenantArea = {
  name: string;
  description: string | null;
  responsibilities: string[];
  authorizations: string[];
};
export type TenantContext = {
  id: string;
  sector: string | null;
  operationalDescription: string | null;
  eventTypes: string[];
  operationMode: TenantOperationMode | null;
  operationalAreas: TenantArea[];
  operationalNotes: string | null;
};
export type TenantContextUpdate = Partial<Omit<TenantContext, 'id'>>;

export async function getTenantContext(): Promise<TenantContext> {
  const response = await apiRequest<{ data: TenantContext }>(
    '/tenants/context',
    {
      credentials: 'include',
      cache: 'no-store',
    },
  );
  return response.data;
}

export async function updateTenantContext(
  payload: TenantContextUpdate,
): Promise<TenantContext> {
  const response = await apiRequest<{ data: TenantContext }>(
    '/tenants/context',
    {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  return response.data;
}

export async function deactivateTenant(id: string): Promise<void> {
  await apiRequest(`/tenants/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
}
