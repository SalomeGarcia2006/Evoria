'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getEvent,
  isActiveEvent,
  type EventItem,
} from '../../services/events.service';
import { getEventBudget } from '../../services/presupuestos.service';
import { apiErrorMessage } from '../../services/api';
import { ProviderDialogShell } from '../providers/ProviderDialogShell';
import { ProviderServices } from '../providers/ProviderServices';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ErrorMessage } from '../ui/ErrorMessage';
import { LoadingState } from '../ui/LoadingState';
import { EventResources } from './EventResources';
import { AssignmentIcon } from './AssignmentIcon';
import { StatusBadge } from '../ui/StatusBadge';

export const assignmentEventStatusLabels = {
  borrador: 'Borrador',
  planificado: 'Planificado',
  en_progreso: 'En ejecución',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

export const assignmentEventDate = (date: string) =>
  new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(date));

export function EventAssignmentsDialog({
  eventId,
  onClose,
  onEventLoaded,
}: {
  eventId: string;
  onClose: () => void;
  onEventLoaded: (event: EventItem) => void;
}) {
  const { can } = useAuth();
  const allowed = can('eventos.ver');
  const canViewBudget = can('presupuestos.ver');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    attempt: number;
    event?: EventItem;
    error?: string;
  }>();
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [budgetRevision, setBudgetRevision] = useState(0);
  const [budgetStatus, setBudgetStatus] = useState<{
    key: string;
    initialized?: boolean;
    error?: string;
  }>();
  const event = result?.attempt === attempt ? result.event : undefined;
  const error = result?.attempt === attempt ? result.error : undefined;
  const active = !!event && isActiveEvent(event.status);
  const budgetKey = `${eventId}:${budgetRevision}`;
  const currentBudget =
    budgetStatus?.key === budgetKey ? budgetStatus : undefined;
  const budgetReady = !canViewBudget || currentBudget?.initialized === true;
  useEffect(() => {
    if (!allowed) return;
    let current = true;
    getEvent(eventId)
      .then((item) => {
        if (!current) return;
        setResult({ attempt, event: item });
        onEventLoaded(item);
      })
      .catch((error: unknown) => {
        if (current) setResult({ attempt, error: apiErrorMessage(error) });
      });
    return () => {
      current = false;
    };
  }, [eventId, attempt, allowed, onEventLoaded]);
  useEffect(() => {
    if (!allowed || !active || !canViewBudget) return;
    let current = true;
    getEventBudget(eventId)
      .then((budget) => {
        if (current)
          setBudgetStatus({ key: budgetKey, initialized: budget.initialized });
      })
      .catch((error: unknown) => {
        if (current)
          setBudgetStatus({ key: budgetKey, error: apiErrorMessage(error) });
      });
    return () => {
      current = false;
    };
  }, [eventId, allowed, active, canViewBudget, budgetKey]);
  function budgetChanged() {
    setBudgetRevision((value) => value + 1);
  }
  function refresh() {
    setAttempt((value) => value + 1);
    budgetChanged();
  }
  return (
    <ProviderDialogShell
      title={event ? `Asignaciones · ${event.name}` : 'Asignaciones del evento'}
      busy={inventoryBusy}
      onClose={onClose}
      size="wide"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Volver a la selección de eventos</p>
          <Button
            variant="secondary"
            disabled={inventoryBusy}
            onClick={onClose}
          >
            Cerrar evento
          </Button>
        </div>
      }
    >
      <div className="grid min-w-0 gap-6">
        {!allowed ? (
          <p role="status">No tienes permiso para consultar este evento.</p>
        ) : error ? (
          <div>
            <ErrorMessage message={error} />
            <Button className="mt-4" onClick={refresh}>
              Reintentar evento
            </Button>
          </div>
        ) : !event ? (
          <LoadingState label="Cargando información del evento…" />
        ) : (
          <>
            <Card
              className="min-w-0"
              style={{
                backgroundColor:
                  'color-mix(in srgb, var(--color-sky-blue) 20%, var(--color-white))',
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <StatusBadge
                    status={assignmentEventStatusLabels[event.status]}
                  />
                  <h3 className="mt-2 break-words text-xl font-bold">
                    {event.name}
                  </h3>
                  {event.description && (
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted">
                      {event.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="secondary"
                  disabled={inventoryBusy}
                  onClick={refresh}
                >
                  Actualizar evento
                </Button>
              </div>
              <dl className="mt-5 grid gap-5 border-t border-sky-blue pt-5 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div className="flex items-start gap-3">
                  <AssignmentIcon name="cronograma" small />
                  <div>
                    <dt className="text-xs text-muted">Inicio</dt>
                    <dd className="mt-1 font-semibold">
                      {assignmentEventDate(event.startAt)}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <AssignmentIcon name="cronograma" small />
                  <div>
                    <dt className="text-xs text-muted">Fin</dt>
                    <dd className="mt-1 font-semibold">
                      {assignmentEventDate(event.endAt)}
                    </dd>
                  </div>
                </div>
                {event.location && (
                  <div className="flex min-w-0 items-start gap-3">
                    <AssignmentIcon name="empresas" small />
                    <div className="min-w-0">
                      <dt className="text-xs text-muted">Lugar</dt>
                      <dd className="mt-1 break-words font-semibold">
                        {event.location}
                      </dd>
                    </div>
                  </div>
                )}
                {event.type && (
                  <div className="flex min-w-0 items-start gap-3">
                    <AssignmentIcon name="eventos" small />
                    <div className="min-w-0">
                      <dt className="text-xs text-muted">Tipo</dt>
                      <dd className="mt-1 break-words font-semibold">
                        {event.type}
                      </dd>
                    </div>
                  </div>
                )}
              </dl>
            </Card>
            {!active ? (
              <Card>
                <p role="status" className="text-sm text-muted">
                  Este evento ya no está activo. Cierra esta ventana y elige
                  otro evento para gestionar asignaciones.
                </p>
              </Card>
            ) : (
              <>
                {canViewBudget ? (
                  !currentBudget ? (
                    <LoadingState label="Comprobando requisitos del presupuesto…" />
                  ) : currentBudget.error ? (
                    <Card>
                      <ErrorMessage message={currentBudget.error} />
                      <Button
                        className="mt-3"
                        variant="secondary"
                        onClick={budgetChanged}
                      >
                        Reintentar presupuesto
                      </Button>
                    </Card>
                  ) : (
                    !currentBudget.initialized && (
                      <Card>
                        <p className="text-sm text-muted">
                          Para crear asignaciones, inicia primero el presupuesto
                          del evento.
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <Link
                            className="font-semibold text-muted underline"
                            href={`/presupuestos?eventId=${encodeURIComponent(eventId)}`}
                          >
                            Ir a Presupuestos →
                          </Link>
                          <Button variant="secondary" onClick={budgetChanged}>
                            Comprobar requisitos de asignación
                          </Button>
                        </div>
                      </Card>
                    )
                  )
                ) : (
                  <p className="text-sm text-muted">
                    Las nuevas asignaciones requieren presupuesto iniciado y
                    saldo suficiente. Si necesitas consultar el saldo, solicita
                    acceso a Presupuestos.
                  </p>
                )}
                <div
                  className={`grid min-w-0 items-start gap-6 ${can('asignaciones.ver') && can('servicios_proveedor.ver') ? 'lg:grid-cols-2' : ''}`}
                >
                  {can('asignaciones.ver') && (
                    <EventResources
                      key={`inventory:${eventId}`}
                      eventId={eventId}
                      editable
                      inDialog
                      budgetReady={budgetReady}
                      onChanged={budgetChanged}
                      onBusyChange={setInventoryBusy}
                    />
                  )}
                  {can('servicios_proveedor.ver') && (
                    <ProviderServices
                      key={`providers:${eventId}`}
                      event={event}
                      inDialog
                      budgetReady={budgetReady}
                      onChanged={budgetChanged}
                    />
                  )}
                </div>
                {!can('asignaciones.ver') &&
                  !can('servicios_proveedor.ver') && (
                    <p role="status" className="text-sm text-muted">
                      Puedes consultar el evento, pero no tienes permisos para
                      ver sus reservas ni servicios.
                    </p>
                  )}
              </>
            )}
          </>
        )}
      </div>
    </ProviderDialogShell>
  );
}
