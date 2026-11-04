import type {
  ApiResponse,
  CreateProviderRequest,
  UpdateProviderRequest,
  Provider,
  ProviderList,
  ProviderListQuery,
  EventProviderService,
  CreateEventProviderServiceRequest,
  UpdateEventProviderServiceRequest,
} from '@evoria/contracts';
import { apiRequest } from './api';

async function request<T>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const response = await apiRequest<ApiResponse<T>>(path, {
    method,
    credentials: 'include',
    cache: 'no-store',
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
  return response.data;
}
export function getProviders(query: ProviderListQuery = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return request<ProviderList>(`/providers?${params}`);
}
export const getProvider = (id: string) =>
  request<Provider>(`/providers/${id}`);
export const createProvider = (body: CreateProviderRequest) =>
  request<Provider>('/providers', 'POST', body);
export const updateProvider = (id: string, body: UpdateProviderRequest) =>
  request<Provider>(`/providers/${id}`, 'PATCH', body);
export const deactivateProvider = (id: string) =>
  request<Provider>(`/providers/${id}`, 'DELETE');
export const getProviderServices = (
  eventId: string,
  includeCancelled = false,
) =>
  request<EventProviderService[]>(
    `/events/${eventId}/provider-services${includeCancelled ? '?includeCancelled=true' : ''}`,
  );
export const createProviderService = (
  eventId: string,
  body: CreateEventProviderServiceRequest,
) =>
  request<EventProviderService>(
    `/events/${eventId}/provider-services`,
    'POST',
    body,
  );
export const updateProviderService = (
  eventId: string,
  id: string,
  body: UpdateEventProviderServiceRequest,
) =>
  request<EventProviderService>(
    `/events/${eventId}/provider-services/${id}`,
    'PATCH',
    body,
  );
export const cancelProviderService = (eventId: string, id: string) =>
  request<EventProviderService>(
    `/events/${eventId}/provider-services/${id}`,
    'DELETE',
  );
