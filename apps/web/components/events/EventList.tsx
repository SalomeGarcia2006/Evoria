'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  cancelEvent,
  EVENT_STATUSES,
  getEvents,
  type EventItem,
  type EventStatus,
  updateEventStatus,
} from '../../services/events.service';
import { getUsers } from '../../services/users.service';
import { Button } from '../ui/Button';
import { ErrorMessage } from '../ui/ErrorMessage';
import { FeedbackMessages, useFeedback } from '../ui/Feedback';
import { LoadingState } from '../ui/LoadingState';
import { EventLocation } from './EventLocation';
import { EventLocationMap } from './EventLocationMap';

const STATUS_LABELS: Record<EventStatus, string> = {
  borrador: 'Borrador',
  planificado: 'Planificado',
  en_progreso: 'En ejecución',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

const STATUS_CLASSES: Record<EventStatus, string> = {
  borrador: 'bg-sky-blue text-navy',
  planificado: 'bg-blue-100 text-blue-800',
  en_progreso: 'bg-amber-100 text-amber-800',
  finalizado: 'bg-emerald-100 text-emerald-800',
  cancelado: 'bg-red-100 text-red-800',
};

const EDITABLE_STATUSES = EVENT_STATUSES.filter(
  (status) => status !== 'cancelado',
);

type EventFilter = 'all' | 'en_progreso' | 'finalizado';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDateBadge(value: string): { day: string; month: string } {
  const date = new Date(value);
  return {
    day: new Intl.DateTimeFormat('es-CO', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('es-CO', { month: 'short' })
      .format(date)
      .replace('.', '')
      .toUpperCase(),
  };
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function matchesEventSearch(event: EventItem, search: string): boolean {
  const normalizedSearch = normalizeSearch(search);
  if (!normalizedSearch) return true;

  const date = new Date(event.startAt);
  const numericDate = `${String(date.getDate()).padStart(2, '0')}/${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}/${date.getFullYear()}`;
  return [
    event.name,
    formatDate(event.startAt),
    date.toLocaleDateString('es-CO'),
    numericDate,
    event.startAt.slice(0, 10),
  ].some((value) => normalizeSearch(value).includes(normalizedSearch));
}

export function EventList({
  onCreate,
  onEdit,
  revision = 0,
}: {
  onCreate?: () => void;
  onEdit?: (event: EventItem) => void;
  revision?: number;
}) {
  const { can } = useAuth();
  const feedback = useFeedback();
  const viewDialog = useRef<HTMLDialogElement>(null);
  const statusDialog = useRef<HTMLDialogElement>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [responsibleNames, setResponsibleNames] = useState<
    Record<string, string>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [statusEvent, setStatusEvent] = useState<EventItem | null>(null);
  const [viewEvent, setViewEvent] = useState<EventItem | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<EventStatus>('borrador');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<EventFilter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let isMounted = true;

    getEvents()
      .then((result) => {
        if (isMounted) setEvents(result.items);
      })
      .catch((loadError: unknown) => {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'No se pudieron cargar los eventos.',
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [revision]);

  useEffect(() => {
    let isMounted = true;
    void getUsers()
      .then((users) => {
        if (!isMounted) return;
        setResponsibleNames(
          Object.fromEntries(users.map((user) => [user.id, user.name])),
        );
      })
      .catch(() => undefined);
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleCancel(event: EventItem) {
    const confirmed = await feedback.confirm(
      '¿Vas a cancelar este evento?',
      `El evento “${event.name}” quedará cancelado y no podrá volver a gestionarse como un evento activo.`,
      'Sí, cancelar evento',
      'warning',
    );
    if (!confirmed) return;

    setCancellingId(event.id);
    setError(null);

    try {
      const cancelledEvent = await cancelEvent(event.id);
      setEvents((currentEvents) =>
        currentEvents.map((currentEvent) =>
          currentEvent.id === cancelledEvent.id ? cancelledEvent : currentEvent,
        ),
      );
      setViewEvent((currentEvent) =>
        currentEvent?.id === cancelledEvent.id ? cancelledEvent : currentEvent,
      );
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : 'No se pudo cancelar el evento.',
      );
    } finally {
      setCancellingId(null);
    }
  }

  function openStatusDialog(event: EventItem) {
    setStatusEvent(event);
    setSelectedStatus(event.status);
    statusDialog.current?.showModal();
  }

  function openViewDialog(event: EventItem) {
    setViewEvent(event);
    viewDialog.current?.showModal();
  }

  function closeViewDialog() {
    viewDialog.current?.close();
    setViewEvent(null);
  }

  function openStatusFromView(event: EventItem) {
    closeViewDialog();
    openStatusDialog(event);
  }

  function editFromView(event: EventItem) {
    closeViewDialog();
    onEdit?.(event);
  }

  function closeStatusDialog() {
    statusDialog.current?.close();
    setStatusEvent(null);
  }

  async function handleStatusUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!statusEvent) return;

    setIsUpdatingStatus(true);
    setError(null);
    try {
      const updatedEvent = await updateEventStatus(
        statusEvent.id,
        selectedStatus,
      );
      setEvents((currentEvents) =>
        currentEvents.map((currentEvent) =>
          currentEvent.id === updatedEvent.id ? updatedEvent : currentEvent,
        ),
      );
      closeStatusDialog();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'No se pudo actualizar el estado del evento.',
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  const inProgressCount = events.filter(
    (event) => event.status === 'en_progreso',
  ).length;
  const finishedCount = events.filter(
    (event) => event.status === 'finalizado',
  ).length;
  const filteredEvents = events.filter(
    (event) =>
      (selectedFilter === 'all' || event.status === selectedFilter) &&
      matchesEventSearch(event, search),
  );
  const upcomingEvent = [...events]
    .filter(
      (event) =>
        event.status !== 'cancelado' &&
        event.status !== 'finalizado' &&
        new Date(event.startAt) >= new Date(),
    )
    .sort(
      (first, second) => Date.parse(first.startAt) - Date.parse(second.startAt),
    )[0];

  return (
    <section className="grid gap-4">
      {error ? <ErrorMessage message={error} /> : null}
      <FeedbackMessages feedback={feedback} />
      {isLoading ? (
        <LoadingState label="Cargando eventos…" />
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-sky-blue bg-white p-8 text-center">
          <p className="font-semibold">No hay eventos registrados.</p>
          {can('eventos.crear') ? (
            onCreate ? (
              <Button className="mt-4" onClick={onCreate} type="button">
                Crear el primer evento
              </Button>
            ) : (
              <Link
                className="mt-4 inline-block rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                href="/eventos/nuevo"
              >
                Crear el primer evento
              </Link>
            )
          ) : null}
        </div>
      ) : (
        <>
          <section className="events-list-panel">
            <div className="events-list-panel__toolbar">
              <div
                className="events-list-panel__filters"
                aria-label="Resumen de eventos"
              >
                <button
                  className={`events-list-panel__filter ${selectedFilter === 'all' ? 'is-active' : ''}`}
                  onClick={() => setSelectedFilter('all')}
                  type="button"
                >
                  Todos ({events.length})
                </button>
                <button
                  className={`events-list-panel__filter ${selectedFilter === 'en_progreso' ? 'is-active' : ''}`}
                  onClick={() => setSelectedFilter('en_progreso')}
                  type="button"
                >
                  En ejecución ({inProgressCount})
                </button>
                <button
                  className={`events-list-panel__filter ${selectedFilter === 'finalizado' ? 'is-active' : ''}`}
                  onClick={() => setSelectedFilter('finalizado')}
                  type="button"
                >
                  Finalizados ({finishedCount})
                </button>
              </div>
              <div className="flex w-full max-w-md items-center justify-end gap-3">
                <label className="sr-only" htmlFor="event-search">
                  Buscar eventos por nombre o fecha
                </label>
                <input
                  className="w-full min-w-0 rounded-xl border border-sky-blue bg-white px-3 py-2 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
                  id="event-search"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nombre o fecha…"
                  type="search"
                  value={search}
                />
                <span className="shrink-0 text-sm text-muted">
                  {filteredEvents.length}{' '}
                  {filteredEvents.length === 1 ? 'evento' : 'eventos'}
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="events-table">
                <thead>
                  <tr>
                    <th>Evento</th>
                    <th>Fecha y hora</th>
                    <th>Ubicación</th>
                    <th>Estado</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((event) => (
                    <tr key={event.id}>
                      <td>
                        <span className="font-semibold text-navy">
                          {event.name}
                        </span>
                      </td>
                      <td>
                        <div className="events-table__detail">
                          <span className="events-table__icon">
                            <Image
                              alt=""
                              aria-hidden="true"
                              height={20}
                              src="/icons/FECHA.svg"
                              width={20}
                            />
                          </span>
                          <span>{formatDate(event.startAt)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="events-table__detail min-w-52">
                          <span className="events-table__icon">
                            <Image
                              alt=""
                              aria-hidden="true"
                              height={20}
                              src="/icons/ubicacion.svg"
                              width={20}
                            />
                          </span>
                          <span className="break-words">
                            <EventLocation value={event.location} />
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASSES[event.status]}`}
                        >
                          {STATUS_LABELS[event.status]}
                        </span>
                      </td>
                      <td className="text-right">
                        <Button
                          className="whitespace-nowrap px-4 py-2 text-xs"
                          onClick={() => openViewDialog(event)}
                          type="button"
                          variant="secondary"
                        >
                          Ver detalles
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredEvents.length === 0 ? (
                    <tr>
                      <td
                        className="py-8 text-center text-sm text-muted"
                        colSpan={5}
                      >
                        No hay eventos que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <p className="events-list-panel__footer">
              Mostrando {filteredEvents.length} de {events.length}{' '}
              {events.length === 1 ? 'evento' : 'eventos'}
            </p>
          </section>
          {upcomingEvent ? (
            <section className="events-upcoming">
              <h2 className="text-xl font-bold">Próximo en tu agenda</h2>
              <div className="events-upcoming__item">
                <div className="events-upcoming__date">
                  <strong>{formatDateBadge(upcomingEvent.startAt).day}</strong>
                  <span>{formatDateBadge(upcomingEvent.startAt).month}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{upcomingEvent.name}</p>
                  <p className="mt-1 break-words text-sm text-muted">
                    <EventLocation value={upcomingEvent.location} />
                  </p>
                </div>
                <Button
                  className="whitespace-nowrap"
                  onClick={() => openViewDialog(upcomingEvent)}
                  type="button"
                  variant="ghost"
                >
                  Consultar evento →
                </Button>
              </div>
            </section>
          ) : null}
        </>
      )}
      <dialog
        aria-labelledby="event-view-dialog-title"
        className="m-auto max-h-[calc(100dvh-2rem)] w-11/12 max-w-3xl overflow-y-auto rounded-[1.5rem] border border-sky-blue bg-white p-0 text-navy shadow-2xl backdrop:bg-navy/60"
        onClose={() => setViewEvent(null)}
        ref={viewDialog}
      >
        <div className="flex items-start justify-between gap-4 border-b border-sky-blue bg-beige/70 p-6">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[.16em] text-muted">
              {viewEvent?.type ?? 'Evento'}
            </p>
            <h2
              className="mt-1 break-words text-3xl font-bold"
              id="event-view-dialog-title"
            >
              {viewEvent?.name}
            </h2>
          </div>
          <Button
            aria-label="Cerrar detalle del evento"
            className="px-3 text-xl leading-none"
            onClick={closeViewDialog}
            type="button"
            variant="ghost"
          >
            ×
          </Button>
        </div>
        {viewEvent ? (
          <div className="grid gap-6 p-6">
            <section className="rounded-[1.125rem] border border-sky-blue bg-beige/55 p-5">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted">
                Descripción
              </p>
              <p className="mt-2 whitespace-pre-wrap leading-6 text-navy">
                {viewEvent.description || 'Sin descripción.'}
              </p>
            </section>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.125rem] border border-sky-blue p-4">
                <p className="text-sm text-muted">Inicio</p>
                <p className="mt-1 font-semibold">
                  {formatDate(viewEvent.startAt)}
                </p>
              </div>
              <div className="rounded-[1.125rem] border border-sky-blue p-4">
                <p className="text-sm text-muted">Finalización</p>
                <p className="mt-1 font-semibold">
                  {formatDate(viewEvent.endAt)}
                </p>
              </div>
              <div className="rounded-[1.125rem] border border-sky-blue p-4">
                <p className="text-sm text-muted">Estado</p>
                <span
                  className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASSES[viewEvent.status]}`}
                >
                  {STATUS_LABELS[viewEvent.status]}
                </span>
              </div>
              <div className="rounded-[1.125rem] border border-sky-blue p-4">
                <p className="text-sm text-muted">Presupuesto base</p>
                <p className="mt-1 font-semibold">
                  {new Intl.NumberFormat('es-CO', {
                    style: 'currency',
                    currency: 'COP',
                    maximumFractionDigits: 0,
                  }).format(viewEvent.baseBudget)}
                </p>
              </div>
              <div className="rounded-[1.125rem] border border-sky-blue p-4">
                <p className="text-sm text-muted">Persona responsable</p>
                <p className="mt-1 break-words font-semibold">
                  {viewEvent.responsibleUserId
                    ? (responsibleNames[viewEvent.responsibleUserId] ??
                      'Responsable asignado')
                    : 'Sin persona responsable asignada'}
                </p>
              </div>
            </div>
            <section className="grid gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted">
                  Ubicación seleccionada
                </p>
                <p className="mt-1 break-words font-semibold">
                  <EventLocation value={viewEvent.location} />
                </p>
              </div>
              <EventLocationMap
                key={viewEvent.location ?? 'sin-ubicacion'}
                value={viewEvent.location}
              />
            </section>
            {viewEvent.status !== 'cancelado' ? (
              <div className="flex flex-wrap gap-3 border-t border-sky-blue pt-5">
                {can('eventos.editar') && onEdit ? (
                  <Button
                    onClick={() => editFromView(viewEvent)}
                    type="button"
                    variant="secondary"
                  >
                    Editar evento
                  </Button>
                ) : null}
                {can('eventos.editar') ? (
                  <Button
                    onClick={() => openStatusFromView(viewEvent)}
                    type="button"
                    variant="secondary"
                  >
                    Modificar estado
                  </Button>
                ) : null}
                {can('eventos.eliminar') ? (
                  <Button
                    className="border border-coral bg-white text-coral shadow-none hover:bg-coral hover:text-white"
                    disabled={cancellingId === viewEvent.id}
                    onClick={() => void handleCancel(viewEvent)}
                    type="button"
                  >
                    {cancellingId === viewEvent.id
                      ? 'Cancelando…'
                      : 'Cancelar evento'}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </dialog>
      <dialog
        aria-labelledby="event-status-dialog-title"
        className="m-auto w-11/12 max-w-md rounded-2xl border border-sky-blue bg-white p-0 text-navy shadow-2xl backdrop:bg-navy/60"
        onClose={() => setStatusEvent(null)}
        ref={statusDialog}
      >
        <div className="flex items-start justify-between gap-4 border-b border-sky-blue p-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.16em] text-muted">
              Eventos
            </p>
            <h2
              className="mt-1 text-2xl font-bold"
              id="event-status-dialog-title"
            >
              Cambiar estado
            </h2>
          </div>
          <Button
            aria-label="Cerrar cambio de estado"
            className="px-3 text-xl leading-none"
            onClick={closeStatusDialog}
            type="button"
            variant="ghost"
          >
            ×
          </Button>
        </div>
        <form className="grid gap-5 p-6" onSubmit={handleStatusUpdate}>
          <p className="text-sm text-muted">{statusEvent?.name}</p>
          <label className="grid gap-2 text-sm font-semibold">
            Nuevo estado
            <select
              className="rounded-lg border border-sky-blue bg-white px-3 py-2 font-normal outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
              onChange={(event) =>
                setSelectedStatus(event.target.value as EventStatus)
              }
              value={selectedStatus}
            >
              {EDITABLE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-3 border-t border-sky-blue pt-5">
            <Button disabled={isUpdatingStatus} type="submit">
              {isUpdatingStatus ? 'Guardando…' : 'Guardar estado'}
            </Button>
            <Button
              onClick={closeStatusDialog}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
