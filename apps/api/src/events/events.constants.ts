export const EVENT_STATUSES = [
  'borrador',
  'planificado',
  'en_progreso',
  'finalizado',
  'cancelado',
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];
