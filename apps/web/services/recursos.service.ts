import type {
  Recurso,
  ResourcePayload,
  ResourceStatus,
} from '../types/recurso';
import { apiRequest } from './api';

export interface ResourceFilters {
  search?: string;
  type?: string;
  status?: ResourceStatus | '';
  page?: number;
  limit?: number;
}
export interface RecursosServiceResult {
  items: Recurso[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
export async function getResources(
  filters: ResourceFilters = {},
): Promise<RecursosServiceResult> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({
    page: 1,
    limit: 20,
    ...filters,
  })) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const response = await apiRequest<{ data: RecursosServiceResult }>(
    `/inventory?${query}`,
    { credentials: 'include', cache: 'no-store' },
  );
  return response.data;
}
export async function getResource(id: string): Promise<Recurso> {
  const response = await apiRequest<{ data: Recurso }>(
    `/inventory/${encodeURIComponent(id)}`,
    { credentials: 'include', cache: 'no-store' },
  );
  return response.data;
}
export async function saveResource(
  payload: ResourcePayload,
  id?: string,
): Promise<Recurso> {
  const body: ResourcePayload = {
    name: payload.name.trim(),
    type: payload.type.trim(),
    description: payload.description?.trim() ?? '',
    unitCost: payload.unitCost,
    totalQuantity: payload.totalQuantity,
    status: payload.status,
  };
  const response = await apiRequest<{ data: Recurso }>(
    id ? `/inventory/${encodeURIComponent(id)}` : '/inventory',
    {
      method: id ? 'PATCH' : 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  return response.data;
}
export async function deactivateResource(id: string): Promise<Recurso> {
  const response = await apiRequest<{ data: Recurso }>(
    `/inventory/${encodeURIComponent(id)}`,
    { method: 'DELETE', credentials: 'include' },
  );
  return response.data;
}

export interface EventResourceAssignment {
  id: string;
  eventId: string;
  inventoryItemId: string;
  quantity: number;
  status: 'asignado' | 'devuelto';
  assignedAt: string;
  returnedAt: string | null;
  inventoryItem: Pick<
    Recurso,
    'id' | 'name' | 'type' | 'availableQuantity' | 'unitCost'
  >;
}

export async function getEventResources(
  eventId: string,
): Promise<EventResourceAssignment[]> {
  const response = await apiRequest<{ data: EventResourceAssignment[] }>(
    `/events/${encodeURIComponent(eventId)}/resources`,
    { credentials: 'include', cache: 'no-store' },
  );
  return response.data;
}

export async function assignEventResource(
  eventId: string,
  inventoryItemId: string,
  quantity: number,
): Promise<EventResourceAssignment> {
  const response = await apiRequest<{ data: EventResourceAssignment }>(
    `/events/${encodeURIComponent(eventId)}/resources`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inventoryItemId, quantity }),
    },
  );
  return response.data;
}

export async function releaseEventResource(
  eventId: string,
  inventoryItemId: string,
): Promise<EventResourceAssignment> {
  const response = await apiRequest<{ data: EventResourceAssignment }>(
    `/events/${encodeURIComponent(eventId)}/resources/${encodeURIComponent(inventoryItemId)}`,
    { method: 'DELETE', credentials: 'include' },
  );
  return response.data;
}

export async function getAvailableInventory(): Promise<Recurso[]> {
  const first = await getResources({
    status: 'disponible',
    limit: 100,
    page: 1,
  });
  const items = [...first.items];
  for (let page = 2; page <= first.pagination.totalPages; page += 1) {
    const next = await getResources({ status: 'disponible', limit: 100, page });
    items.push(...next.items);
  }
  return items.filter((item) => item.availableQuantity > 0);
}
