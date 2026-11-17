export const PROVIDER_SERVICE_STATUSES = [
  'pendiente',
  'aceptado_sin_saldo',
  'confirmado',
  'rechazado',
  'vencido',
  'cancelado',
] as const;
export type ProviderServiceStatus = (typeof PROVIDER_SERVICE_STATUSES)[number];
