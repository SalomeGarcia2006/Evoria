export const PROVIDER_CATEGORIES = [
  'transporte',
  'alimentacion',
  'espacios',
  'decoracion',
  'audiovisual',
  'otros',
] as const;

export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];
export const PROVIDER_STATUSES = ['activo', 'inactivo'] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];
