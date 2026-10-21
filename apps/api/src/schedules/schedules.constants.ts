export const SCHEDULE_STATUSES = [
  'pendiente',
  'en_progreso',
  'completado',
  'cancelado',
] as const;

export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];
