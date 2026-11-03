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

export interface Provider {
  id: string;
  name: string;
  categoryKeys: ProviderCategory[];
  contactName: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  notes: string | null;
  status: ProviderStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProviderRequest {
  name: string;
  categoryKeys: ProviderCategory[];
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  location?: string | null;
  notes?: string | null;
}

export type UpdateProviderRequest = Partial<CreateProviderRequest>;

export interface ProviderListQuery {
  search?: string;
  category?: ProviderCategory;
  status?: ProviderStatus;
  page?: number;
  limit?: number;
}

export interface ProviderList {
  items: Provider[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
