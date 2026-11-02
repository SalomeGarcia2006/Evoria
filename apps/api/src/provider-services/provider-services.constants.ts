export const PROVIDER_SERVICE_STATUSES = ['confirmado', 'cancelado'] as const;
export type ProviderServiceStatus = (typeof PROVIDER_SERVICE_STATUSES)[number];
