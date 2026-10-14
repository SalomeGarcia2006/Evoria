export const PERMISSION_STATUSES = ['activo', 'inactivo'] as const;
export type PermissionStatus = (typeof PERMISSION_STATUSES)[number];

export const INITIAL_PERMISSIONS = [
  {
    key: 'usuarios.gestionar',
    name: 'Gestionar usuarios',
    description: 'Crear, consultar, editar y desactivar usuarios.',
  },
  {
    key: 'perfiles.gestionar',
    name: 'Gestionar perfiles',
    description: 'Crear, consultar, editar y desactivar perfiles.',
  },
  {
    key: 'permisos.gestionar',
    name: 'Gestionar permisos',
    description: 'Crear, consultar, editar y desactivar permisos.',
  },
] as const;
