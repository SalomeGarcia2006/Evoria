export const PERMISSION_STATUSES = ['activo', 'inactivo'] as const;
export type PermissionStatus = (typeof PERMISSION_STATUSES)[number];

type PermissionAction = {
  key: string;
  name: string;
};

type PermissionModule = {
  key: string;
  name: string;
  description: string;
  scope: 'platform' | 'tenant';
  actions: readonly PermissionAction[];
};

export const INITIAL_PERMISSION_MODULES = [
  {
    key: 'empresas',
    name: 'Empresas',
    description: 'Administración de las empresas registradas en Evoria.',
    scope: 'platform',
    actions: [
      { key: 'ver', name: 'Ver' },
      { key: 'crear', name: 'Crear' },
      { key: 'editar', name: 'Editar' },
      { key: 'desactivar', name: 'Desactivar' },
    ],
  },
  {
    key: 'usuarios',
    name: 'Usuarios',
    description: 'Gestión de los usuarios de la empresa.',
    scope: 'tenant',
    actions: [
      { key: 'ver', name: 'Ver' },
      { key: 'crear', name: 'Crear' },
      { key: 'editar', name: 'Editar' },
      { key: 'desactivar', name: 'Desactivar' },
    ],
  },
  {
    key: 'perfiles',
    name: 'Perfiles',
    description: 'Gestión de perfiles y asignación de permisos.',
    scope: 'tenant',
    actions: [
      { key: 'ver', name: 'Ver' },
      { key: 'crear', name: 'Crear' },
      { key: 'editar', name: 'Editar' },
      { key: 'desactivar', name: 'Desactivar' },
    ],
  },
  {
    key: 'eventos',
    name: 'Eventos',
    description: 'Planificación y gestión de eventos.',
    scope: 'tenant',
    actions: [
      { key: 'ver', name: 'Ver' },
      { key: 'crear', name: 'Crear' },
      { key: 'editar', name: 'Editar' },
      { key: 'eliminar', name: 'Eliminar' },
    ],
  },
  {
    key: 'cronogramas',
    name: 'Cronogramas',
    description: 'Gestión de actividades y fechas de los eventos.',
    scope: 'tenant',
    actions: [
      { key: 'ver', name: 'Ver' },
      { key: 'crear', name: 'Crear' },
      { key: 'editar', name: 'Editar' },
      { key: 'eliminar', name: 'Eliminar' },
    ],
  },
  {
    key: 'presupuestos',
    name: 'Presupuestos',
    description: 'Consulta y actualización de presupuestos de eventos.',
    scope: 'tenant',
    actions: [
      { key: 'ver', name: 'Ver' },
      { key: 'editar', name: 'Editar' },
    ],
  },
  {
    key: 'recursos',
    name: 'Recursos',
    description: 'Gestión de recursos disponibles para eventos.',
    scope: 'tenant',
    actions: [
      { key: 'ver', name: 'Ver' },
      { key: 'crear', name: 'Crear' },
      { key: 'editar', name: 'Editar' },
      { key: 'eliminar', name: 'Eliminar' },
    ],
  },
  {
    key: 'asignaciones',
    name: 'Asignaciones',
    description: 'Asignación de recursos a eventos.',
    scope: 'tenant',
    actions: [
      { key: 'ver', name: 'Ver' },
      { key: 'crear', name: 'Crear' },
      { key: 'eliminar', name: 'Eliminar' },
    ],
  },
  {
    key: 'inventario',
    name: 'Inventario',
    description: 'Consulta y ajustes de existencias de recursos.',
    scope: 'tenant',
    actions: [
      { key: 'ver', name: 'Ver' },
      { key: 'ajustar', name: 'Ajustar' },
    ],
  },
  {
    key: 'alertas',
    name: 'Alertas',
    description: 'Consulta y gestión de alertas.',
    scope: 'tenant',
    actions: [
      { key: 'ver', name: 'Ver' },
      { key: 'editar', name: 'Editar' },
    ],
  },
  {
    key: 'auditoria',
    name: 'Auditoría',
    description: 'Consulta del historial de acciones administrativas.',
    scope: 'tenant',
    actions: [{ key: 'ver', name: 'Ver' }],
  },
  {
    key: 'dashboard',
    name: 'Dashboard',
    description: 'Consulta de métricas generales de la empresa.',
    scope: 'tenant',
    actions: [{ key: 'ver', name: 'Ver' }],
  },
  {
    key: 'reportes',
    name: 'Reportes',
    description: 'Consulta y generación de reportes.',
    scope: 'tenant',
    actions: [{ key: 'ver', name: 'Ver' }],
  },
] as const satisfies readonly PermissionModule[];

export const INITIAL_PERMISSIONS = INITIAL_PERMISSION_MODULES.flatMap(
  ({
    key: moduleKey,
    name: moduleName,
    description: moduleDescription,
    scope,
    actions,
  }) =>
    actions.map(({ key: action, name }) => ({
      key: `${moduleKey}.${action}`,
      moduleKey,
      moduleName,
      moduleDescription,
      scope,
      action,
      name,
    })),
);

export const PLATFORM_PERMISSION_KEYS = INITIAL_PERMISSIONS.filter(
  (permission) => permission.scope === 'platform',
).map((permission) => permission.key);

export const TENANT_PERMISSION_KEYS = INITIAL_PERMISSIONS.filter(
  (permission) => permission.scope === 'tenant',
).map((permission) => permission.key);

export const LEGACY_PERMISSION_KEYS = [
  'usuarios.gestionar',
  'perfiles.gestionar',
  'permisos.gestionar',
] as const;
