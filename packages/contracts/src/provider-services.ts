import type { ProviderCategory, ProviderStatus } from './providers';

export const PROVIDER_SERVICE_STATUSES = [
  'pendiente',
  'aceptado_sin_saldo',
  'confirmado',
  'rechazado',
  'vencido',
  'cancelado',
] as const;
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
  responseExpiresAt: string | null;
  acceptedAt: string | null;
  respondedAt: string | null;
  responseDecision: 'aceptar' | 'rechazar' | null;
  fundingExpiresAt: string | null;
  confirmedAt: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  emailDelivery: 'queued' | 'sent' | 'failed' | null;
  emailSentAt: string | null;
}

export interface CreateEventProviderServiceRequest {
  idempotencyKey?: string;
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
  status?: ProviderServiceStatus;
  includeCancelled?: boolean;
}

export interface ProviderServiceConfirmationLinkRequest {
  serviceId: string;
  token: string;
}
export interface ProviderServiceConfirmationResponseRequest extends ProviderServiceConfirmationLinkRequest {
  decision: 'aceptar' | 'rechazar';
  reason?: string;
}
export interface ProviderServiceConfirmationDetails {
  serviceId: string;
  eventName: string;
  serviceName: string;
  description: string | null;
  startDate: string;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  agreedAmountCop: number;
  status: ProviderServiceStatus;
  responseExpiresAt: string | null;
  fundingExpiresAt: string | null;
  canRespond: boolean;
}
