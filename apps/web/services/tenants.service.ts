import { apiRequest } from './api';

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
  const response = await apiRequest<{ data: CreatedTenant }>(
    '/tenants',
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  return response.data;
}
