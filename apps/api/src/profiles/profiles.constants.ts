export const PROFILE_STATUSES = ['activo', 'inactivo'] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

export const ADMINISTRATOR_PROFILE_NAME = 'Administrador';
