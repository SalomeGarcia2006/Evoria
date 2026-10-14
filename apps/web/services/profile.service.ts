export const PROFILE_STORAGE_KEY = 'evoria-profiles';

export const MODULES = [
  'Eventos',
  'Recursos',
  'Inventario',
  'Presupuestos',
  'Cronograma',
  'Alertas',
  'Reportes',
  'Auditoría',
] as const;

export const ACTIONS = ['Crear', 'Editar', 'Ver', 'Eliminar'] as const;
export type ProfileAction = (typeof ACTIONS)[number];
export type Permissions = Record<string, Record<ProfileAction, boolean>>;

export type Profile = {
  id: string;
  name: string;
  status: 'Activo' | 'Inactivo';
  permissions: Permissions;
};

export function createPermissions(): Permissions {
  return Object.fromEntries(
    MODULES.map((moduleName) => [
      moduleName,
      { Crear: false, Editar: false, Ver: true, Eliminar: false },
    ]),
  ) as Permissions;
}

export const initialProfiles: Profile[] = [
  {
    id: 'administrator',
    name: 'Administrador',
    status: 'Activo',
    permissions: createPermissions(),
  },
  {
    id: 'event-coordinator',
    name: 'Coordinadora de eventos',
    status: 'Activo',
    permissions: createPermissions(),
  },
  {
    id: 'resource-manager',
    name: 'Gestor de recursos',
    status: 'Activo',
    permissions: createPermissions(),
  },
  {
    id: 'administrative-assistant',
    name: 'Asistente administrativa',
    status: 'Activo',
    permissions: createPermissions(),
  },
];

export function loadProfiles(): Profile[] {
  if (typeof window === 'undefined') return initialProfiles;

  const storedProfiles = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!storedProfiles) return initialProfiles;

  try {
    return JSON.parse(storedProfiles) as Profile[];
  } catch {
    return initialProfiles;
  }
}

export function saveProfiles(profiles: Profile[]): void {
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
}
