'use client';
import cardStyles from '../../../components/ui/InventoryStyleCard.module.css';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { PageHero } from '../../../components/ui/PageHero';
import { ModuleBanner } from '../../../components/ui/ModuleBanner';
import panelHeadingStyles from '../../../components/ui/PanelHeading.module.css';
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
        if (current)
          setResult((previous) => ({
            attempt,
            events: previous?.events,
            error: apiErrorMessage(error),
          }));
      });
    return () => {
      current = false;
    };
  }, [attempt, canSeeEvents]);
  const events = result?.events?.filter((event) => isActiveEvent(event.status));
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
    <AppShell hideTitle title="Asignación de recursos">
      <div className="grid min-w-0 gap-6">
        <PageHero
          title="Asignación de recursos"
          description="Organiza el inventario y los servicios de cada evento."
          actions={
            <>
              {canSeeEvents && (
                <Button
                  variant="secondary"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  Actualizar eventos
                </Button>
              )}
              {can('inventario.ver') && (
                <Link
                  href="/inventario"
                  className="text-sm font-semibold text-muted underline"
                >
                  Ver inventario →
                </Link>
              )}
            </>
          }
        />
        <ModuleBanner
          icon="recursos.svg"
          title="Recursos para cada evento"
          description="Consulta las reservas de inventario y los servicios asignados a tus eventos activos."
        />
        {error && events && (
          <Card>
            <ErrorMessage message={error} />
            <Button
              className="mt-4"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Reintentar eventos
            </Button>
          </Card>
        )}
        {!canSeeEvents ? (
          <Card>
            <p role="status">
              Necesitas permiso de consulta de eventos para seleccionar un
              evento y consultar sus asignaciones.
            </p>
          </Card>
        ) : error && !events ? (
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
            <p className="mt-2 text-sm text-muted">
              Aquí aparecen los eventos en borrador, planificados y en
              ejecución. Los eventos finalizados o cancelados no admiten nuevas
              asignaciones desde esta vista.
            </p>
            {can('eventos.crear') && (
              <Link
                href="/eventos/nuevo"
                className="mt-4 inline-block font-semibold text-muted underline"
              >
                Crear evento →
              </Link>
            )}
          </Card>
        ) : (
          <section
            aria-label="Eventos activos para asignar recursos"
            className="module-panel"
          >
            <div
              className={`module-panel__heading ${panelHeadingStyles.heading}`}
            >
              <h2 className="text-xl font-bold">Eventos activos</h2>
              <p className="mt-1 text-sm text-muted">
                Selecciona un evento para consultar sus asignaciones.
              </p>
            </div>
            <div className="module-panel__content grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {events.map((event) => (
                <button
                  type="button"
                  key={event.id}
                  aria-haspopup="dialog"
                  aria-expanded={selectedId === event.id}
                  aria-label={`Ver asignaciones de ${event.name}`}
                  onClick={() => setSelectedId(event.id)}
                  className={`${cardStyles.card} ${cardStyles.interactive} group flex h-full flex-col items-start text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal`}
                >
                  <div className="flex w-full flex-wrap items-center justify-between gap-3">
                    <AssignmentIcon name="eventos" small />
                    <StatusBadge
                      status={assignmentEventStatusLabels[event.status]}
                    />
                  </div>
                  <h2
                    title={event.name}
                    className="mt-5 line-clamp-2 break-words text-2xl font-bold leading-tight"
                  >
                    {event.name}
                  </h2>
                  <p className="mt-2 flex items-center gap-2 text-xs text-muted">
                    <AssignmentIcon name="cronograma" small plain />
                    {assignmentEventDate(event.startAt)}
                  </p>
                  {event.location && (
                    <p className="mt-2 flex items-center gap-2 break-words text-xs text-muted">
                      <AssignmentIcon name="empresas" small plain />
                      <span
                        className="line-clamp-1 min-w-0 break-words"
                        title={event.location}
                      >
                        {event.location}
                      </span>
                    </p>
                  )}
                  <span className="mt-auto w-full border-t border-violet/20 pt-4 text-right text-base font-semibold text-violet">
                    Ver detalles y asignar →
                  </span>
                </button>
              ))}
            </div>
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
