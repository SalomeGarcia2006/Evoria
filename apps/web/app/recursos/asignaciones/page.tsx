'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { LoadingState } from '../../../components/ui/LoadingState';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { AssignmentIcon } from '../../../components/resources/AssignmentIcon';
import {
  EventAssignmentsDialog,
  assignmentEventDate,
  assignmentEventStatusLabels,
} from '../../../components/resources/EventAssignmentsDialog';
import {
  getAllEvents,
  isActiveEvent,
  type EventItem,
} from '../../../services/events.service';
import { apiErrorMessage } from '../../../services/api';
import { useAuth } from '../../../hooks/useAuth';

export default function AsignacionesPage() {
  const { user } = useAuth();
  return <AssignmentsContent key={`${user?.tenant?.id}:${user?.id}`} />;
}

function AssignmentsContent() {
  const { can } = useAuth();
  const canSeeEvents = can('eventos.ver');
  const [selectedId, setSelectedId] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    attempt: number;
    events?: EventItem[];
    error?: string;
  }>();
  useEffect(() => {
    if (!canSeeEvents) return;
    let current = true;
    getAllEvents()
      .then((events) => {
        if (current) setResult({ attempt, events });
      })
      .catch((error: unknown) => {
        if (current) setResult({ attempt, error: apiErrorMessage(error) });
      });
    return () => {
      current = false;
    };
  }, [attempt, canSeeEvents]);
  const events =
    result?.attempt === attempt
      ? result.events?.filter((event) => isActiveEvent(event.status))
      : undefined;
  const error = result?.attempt === attempt ? result.error : undefined;
  const onEventLoaded = useCallback((event: EventItem) => {
    setResult((previous) =>
      previous
        ? {
            ...previous,
            events: previous.events?.map((item) =>
              item.id === event.id ? event : item,
            ),
          }
        : previous,
    );
  }, []);
  return (
    <AppShell title="Asignación de recursos">
      <div className="grid min-w-0 gap-6">
        {can('inventario.ver') && (
          <Link
            href="/inventario"
            className="text-sm font-semibold text-teal underline"
          >
            ← Ver inventario
          </Link>
        )}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.16em] text-teal">
              Recursos de tu empresa
            </p>
            <h1 className="mt-2 text-3xl font-bold">Asignación de recursos</h1>
            <p className="mt-2 text-teal">
              Organiza el inventario y los servicios de cada evento
            </p>
          </div>
          {canSeeEvents && (
            <Button
              variant="secondary"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Actualizar eventos
            </Button>
          )}
        </header>
        {!canSeeEvents ? (
          <Card>
            <p role="status">
              Necesitas permiso de consulta de eventos para seleccionar un
              evento y consultar sus asignaciones.
            </p>
          </Card>
        ) : error ? (
          <Card>
            <ErrorMessage message={error} />
            <Button
              className="mt-4"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Reintentar eventos
            </Button>
          </Card>
        ) : !events ? (
          <LoadingState label="Cargando eventos activos…" />
        ) : !events.length ? (
          <Card>
            <h2 className="text-xl font-bold">No hay eventos activos</h2>
            <p className="mt-2 text-sm text-teal">
              Aquí aparecen los eventos en borrador, planificados y en
              ejecución. Los eventos finalizados o cancelados no admiten nuevas
              asignaciones desde esta vista.
            </p>
            {can('eventos.crear') && (
              <Link
                href="/eventos/nuevo"
                className="mt-4 inline-block font-semibold text-teal underline"
              >
                Crear evento →
              </Link>
            )}
          </Card>
        ) : (
          <section
            aria-label="Eventos activos para asignar recursos"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          >
            {events.map((event) => (
              <button
                type="button"
                key={event.id}
                aria-haspopup="dialog"
                aria-expanded={selectedId === event.id}
                aria-label={`Ver asignaciones de ${event.name}`}
                onClick={() => setSelectedId(event.id)}
                className="group flex h-full min-w-0 flex-col items-start rounded-2xl border border-sky-blue bg-white p-4 text-left shadow-sm transition hover:border-teal hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal active:bg-sky-blue/20"
              >
                <div className="flex w-full flex-wrap items-center justify-between gap-3">
                  <AssignmentIcon name="eventos" small />
                  <StatusBadge
                    status={assignmentEventStatusLabels[event.status]}
                  />
                </div>
                <h2
                  title={event.name}
                  className="mt-3 line-clamp-2 break-words text-base font-bold"
                >
                  {event.name}
                </h2>
                <p className="mt-2 flex items-center gap-2 text-xs text-teal">
                  <AssignmentIcon name="cronograma" small plain />
                  {assignmentEventDate(event.startAt)}
                </p>
                {event.location && (
                  <p className="mt-2 flex items-center gap-2 break-words text-xs text-teal">
                    <AssignmentIcon name="empresas" small plain />
                    <span
                      className="line-clamp-1 min-w-0 break-words"
                      title={event.location}
                    >
                      {event.location}
                    </span>
                  </p>
                )}
                <span className="mt-3 w-full border-t border-sky-blue pt-3 text-sm font-semibold text-teal group-hover:text-navy">
                  Ver detalles y asignar →
                </span>
              </button>
            ))}
          </section>
        )}
        {selectedId && canSeeEvents && (
          <EventAssignmentsDialog
            key={selectedId}
            eventId={selectedId}
            onClose={() => setSelectedId('')}
            onEventLoaded={onEventLoaded}
          />
        )}
      </div>
    </AppShell>
  );
}
