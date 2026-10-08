export const ROLE_NAMES = [
  'Administrador',
  'Coordinador',
  'Empleado',
  'Proveedor',
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

export const INITIAL_ROLES: ReadonlyArray<{
  name: RoleName;
  description: string;
}> = [
  {
    name: 'Administrador',
    description: 'Gestiona todos los módulos y usuarios del sistema.',
  },
  {
    name: 'Coordinador',
    description: 'Gestiona eventos, cronogramas, recursos y presupuestos.',
  },
  {
    name: 'Empleado',
    description: 'Consulta eventos y actualiza las actividades asignadas.',
  },
  {
    name: 'Proveedor',
    description: 'Consulta la información relacionada con su participación.',
  },
];
