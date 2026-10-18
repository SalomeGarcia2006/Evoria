export const PROFILE_STATUSES = ['activo', 'inactivo'] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

export const PROFILE_SCOPES = ['platform', 'tenant'] as const;
export type ProfileScope = (typeof PROFILE_SCOPES)[number];

export const ADMINISTRATOR_PROFILE_NAME = 'Administrador';
export const DEVELOPER_PROFILE_NAME = 'Desarrollador';
