export const RESOURCE_ASSIGNMENT_STATUSES = ['asignado', 'devuelto'] as const;

export type ResourceAssignmentStatus =
  (typeof RESOURCE_ASSIGNMENT_STATUSES)[number];
