'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  cancelEvent,
  getEvents,
  type EventItem,
  type EventStatus,
} from '../../services/events.service';
import { Button } from '../ui/Button';
import { DataTable, type DataTableColumn } from '../ui/DataTable';
import { ErrorMessage } from '../ui/ErrorMessage';
import { LoadingState } from '../ui/LoadingState';

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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function EventList({
  onCreate,
  revision = 0,
}: {
  onCreate?: () => void;
  revision?: number;
}) {
  const { can } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

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

  const columns: DataTableColumn<EventItem>[] = [
    {
      key: 'name',
      header: 'Nombre',
      render: (event) => (
        <Link
          className="font-semibold text-navy underline-offset-4 hover:underline"
          href={`/eventos/${event.id}`}
        >
          {event.name}
        </Link>
      ),
    },
    {
      key: 'date',
      header: 'Fecha',
      render: (event) => formatDate(event.startAt),
    },
    {
      key: 'location',
      header: 'Ubicación',
      render: (event) => event.location ?? 'Sin ubicación',
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
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-lg border border-teal px-3 py-1.5 text-xs font-semibold text-navy hover:bg-sky-blue"
            href={`/eventos/${event.id}`}
          >
            Ver
          </Link>
          {can('eventos.eliminar') && event.status !== 'cancelado' ? (
            <Button
              className="px-3 py-1.5 text-xs"
              disabled={cancellingId === event.id}
              onClick={() => void handleCancel(event)}
              type="button"
            >
              {cancellingId === event.id ? 'Cancelando…' : 'Cancelar'}
            </Button>
          ) : null}
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
    </section>
  );
}
