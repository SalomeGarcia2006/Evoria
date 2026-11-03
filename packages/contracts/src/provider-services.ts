import type { ProviderCategory, ProviderStatus } from './providers';

export const PROVIDER_SERVICE_STATUSES = ['confirmado', 'cancelado'] as const;
export type ProviderServiceStatus = (typeof PROVIDER_SERVICE_STATUSES)[number];

export interface EventProviderService {
  id: string;
  eventId: string;
  providerId: string;
  provider: {
    id: string;
    name: string;
    categoryKeys: ProviderCategory[];
    status: ProviderStatus;
  };
  serviceName: string;
  description: string | null;
  startDate: string;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  agreedAmountCop: number;
  status: ProviderServiceStatus;
  assignedBy: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
}

export interface CreateEventProviderServiceRequest {
  providerId: string;
  serviceName: string;
  description?: string | null;
  startDate: string;
  startTime?: string | null;
  endDate?: string | null;
  endTime?: string | null;
  agreedAmountCop: number;
}

export type UpdateEventProviderServiceRequest =
  Partial<CreateEventProviderServiceRequest>;

export interface EventProviderServicesQuery {
  includeCancelled?: boolean;
}
