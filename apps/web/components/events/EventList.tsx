'use client';

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
import { Button } from '../ui/Button';
import { DataTable, type DataTableColumn } from '../ui/DataTable';
import { ErrorMessage } from '../ui/ErrorMessage';
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
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
  const viewDialog = useRef<HTMLDialogElement>(null);
  const statusDialog = useRef<HTMLDialogElement>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [statusEvent, setStatusEvent] = useState<EventItem | null>(null);
  const [viewEvent, setViewEvent] = useState<EventItem | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<EventStatus>('borrador');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

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

  async function handleCancel(event: EventItem) {
    if (!window.confirm(`¿Deseas cancelar el evento "${event.name}"?`)) return;

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

  const columns: DataTableColumn<EventItem>[] = [
    {
      key: 'name',
      header: 'Nombre',
      render: (event) => <span className="font-semibold">{event.name}</span>,
    },
    {
      key: 'date',
      header: 'Fecha',
      render: (event) => (
        <span className="whitespace-nowrap">{formatDate(event.startAt)}</span>
      ),
    },
    {
      key: 'location',
      header: 'Ubicación',
      render: (event) => (
        <span className="block max-w-md break-words">
          <EventLocation value={event.location} />
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (event) => (
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASSES[event.status]}`}
        >
          {STATUS_LABELS[event.status]}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (event) => (
        <div className="flex gap-2 whitespace-nowrap">
          <Button
            className="px-3 py-1.5 text-xs"
            onClick={() => openViewDialog(event)}
            type="button"
            variant="secondary"
          >
            Ver
          </Button>
        </div>
      ),
    },
  ];

  return (
    <section className="grid gap-4">
      {error ? <ErrorMessage message={error} /> : null}
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
        <DataTable
          columns={columns}
          rowKey={(event) => event.id}
          rows={events}
        />
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
