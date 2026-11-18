export type EventStatus =
  'borrador' | 'planificado' | 'en_progreso' | 'finalizado' | 'cancelado';

/** Client details belong to this event; identification remains a string. */
export interface EventClient {
  name: string;
  identification: string;
  phone: string;
  address: string;
  email: string;
}

export interface CreateEventRequest {
  name: string;
  client: EventClient;
  description?: string;
  startAt: string;
  endAt: string;
  location?: string;
  type?: string;
  baseBudget: number;
  invitados?: number;
  status?: EventStatus;
  responsibleUserId?: string;
}

export interface UpdateEventRequest {
  name?: string;
  /** Complete replacement. Omission preserves the stored client. */
  client?: EventClient;
  description?: string | null;
  startAt?: string;
  endAt?: string;
  location?: string | null;
  type?: string | null;
  /** Compatibility only: changing this value requires the budget request flow. */
  baseBudget?: number;
  invitados?: number;
  status?: EventStatus;
  responsibleUserId?: string | null;
}

export interface EventItem {
  id: string;
  name: string;
  /** null for historical events whose client has not been recorded yet. */
  client: EventClient | null;
  description: string | null;
  startAt: string;
  endAt: string;
  location: string | null;
  type: string | null;
  baseBudget: number;
  invitados: number;
  status: EventStatus;
  responsibleUserId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventQuery {
  from?: string;
  to?: string;
  status?: EventStatus;
  page?: number;
  limit?: number;
}

export interface EventList {
  items: EventItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
