'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  EventAssignmentsDialog,
  assignmentEventDate,
  assignmentEventStatusLabels,
} from '../../../../components/resources/EventAssignmentsDialog';
import { EventResources } from '../../../../components/resources/EventResources';
import { AppShell } from '../../../../components/layout/AppShell';
import { ProviderServices } from '../../../../components/providers/ProviderServices';
import { Button } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import { ErrorMessage } from '../../../../components/ui/ErrorMessage';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { ModuleBanner } from '../../../../components/ui/ModuleBanner';
import { PageHero } from '../../../../components/ui/PageHero';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { useAuth } from '../../../../hooks/useAuth';
import { apiErrorMessage } from '../../../../services/api';
import {
  getEvent,
  isActiveEvent,
  type EventItem,
} from '../../../../services/events.service';

export default function AssignmentDetailsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { can } = useAuth();
  const [event, setEvent] = useState<EventItem>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [detailsRevision, setDetailsRevision] = useState(0);
  const canAssign =
    (can('asignaciones.crear') && can('inventario.ver')) ||
    (can('servicios_proveedor.crear') && can('proveedores.ver'));

  useEffect(() => {
    if (!can('eventos.ver')) return;
    let active = true;
    getEvent(eventId)
      .then((item) => {
        if (!active) return;
        setError('');
        setEvent(item);
      })
      .catch((reason: unknown) => {
        if (active) setError(apiErrorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [attempt, can, eventId]);

  return (
    <AppShell hideTitle title="Detalle de asignaciones">
      <div className="grid min-w-0 gap-6">
        <PageHero
          title="Detalle de asignaciones"
          description="Consulta los recursos y servicios vinculados al evento antes de realizar cambios."
          actions={
            <Link
              className="text-sm font-semibold text-muted underline"
              href="/recursos/asignaciones"
            >
              ← Volver a eventos activos
            </Link>
          }
        />
        <ModuleBanner
          icon="recursos.svg"
          title="Asignaciones del evento"
          description="Aquí se muestran las reservas de inventario y los servicios ya asignados."
        />
        {!can('eventos.ver') ? (
          <Card>
            <p role="status">No tienes permiso para consultar este evento.</p>
          </Card>
        ) : error && !event ? (
          <Card>
            <ErrorMessage message={error} />
            <Button
              className="mt-4"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Reintentar
            </Button>
          </Card>
        ) : !event ? (
          <LoadingState label="Cargando asignaciones del evento…" />
        ) : (
          <>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <StatusBadge
                    status={assignmentEventStatusLabels[event.status]}
                  />
                  <h2 className="mt-3 break-words text-2xl font-bold">
                    {event.name}
                  </h2>
                  <p className="mt-2 text-sm text-muted">
                    Inicio: {assignmentEventDate(event.startAt)}
                  </p>
                </div>
                {canAssign && isActiveEvent(event.status) && (
                  <Button onClick={() => setAssignmentOpen(true)}>
                    Asignar recursos
                  </Button>
                )}
              </div>
              {event.description && (
                <p className="mt-4 whitespace-pre-wrap break-words text-sm text-muted">
                  {event.description}
                </p>
              )}
            </Card>
            <section
              aria-label="Asignaciones actuales"
              className="grid min-w-0 items-start gap-6 lg:grid-cols-2"
            >
              {can('asignaciones.ver') && (
                <EventResources
                  eventId={event.id}
                  inDialog
                  editable
                  showAssignmentForm={false}
                  refreshRevision={detailsRevision}
                />
              )}
              {can('servicios_proveedor.ver') && (
                <ProviderServices
                  event={event}
                  inDialog
                  readOnly
                  refreshRevision={detailsRevision}
                />
              )}
            </section>
            {!can('asignaciones.ver') && !can('servicios_proveedor.ver') && (
              <Card>
                <p className="text-sm text-muted">
                  No tienes permisos para consultar las reservas ni los
                  servicios de este evento.
                </p>
              </Card>
            )}
            {assignmentOpen && (
              <EventAssignmentsDialog
                eventId={event.id}
                onClose={() => {
                  setAssignmentOpen(false);
                  setDetailsRevision((value) => value + 1);
                }}
                onEventLoaded={setEvent}
              />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
