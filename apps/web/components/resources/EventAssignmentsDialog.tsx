'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
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
import { FeedbackMessages, useFeedback } from '../ui/Feedback';

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
    eventId: string;
    event?: EventItem;
    error?: string;
  }>();
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [inventoryRefreshing, setInventoryRefreshing] = useState(false);
  const [servicesRefreshing, setServicesRefreshing] = useState(false);
  const [inventoryResult, setInventoryResult] = useState<{
    revision: number;
    errors: string[];
    inventoryChecked: boolean;
  }>();
  const [servicesResult, setServicesResult] = useState<{
    revision: number;
    errors: string[];
  }>();
  const notifiedAttempt = useRef(0);
  const feedback = useFeedback();
  const { notify } = feedback;
  const [budgetRevision, setBudgetRevision] = useState(0);
  const [budgetStatus, setBudgetStatus] = useState<{
    key: string;
    initialized?: boolean;
    error?: string;
  }>();
  const [committedAttempt, setCommittedAttempt] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);
  const [visibleSnapshot, setVisibleSnapshot] = useState<{
    event?: EventItem;
    budget?: { key: string; initialized?: boolean; error?: string };
  }>({});
  const event = result?.eventId === eventId ? result.event : undefined;
  const error =
    result?.eventId === eventId && result.attempt === attempt
      ? result.error
      : undefined;
  const eventLoading =
    result?.eventId !== eventId || result.attempt !== attempt;
  const active = !!event && isActiveEvent(event.status);
  const budgetKey = `${eventId}:${budgetRevision}`;
  const previousBudget = budgetStatus?.key.startsWith(`${eventId}:`)
    ? budgetStatus
    : undefined;
  const currentBudget =
    previousBudget?.key === budgetKey ? previousBudget : undefined;
  const budgetChecking = canViewBudget && active && !currentBudget;
  const awaitingCommit = attempt !== committedAttempt;
  const updating =
    eventLoading ||
    budgetChecking ||
    inventoryRefreshing ||
    servicesRefreshing ||
    awaitingCommit;
  const budgetReady = !canViewBudget || previousBudget?.initialized === true;
  const visibleEvent = awaitingCommit
    ? (visibleSnapshot.event ?? event)
    : event;
  const visibleBudget = awaitingCommit
    ? visibleSnapshot.budget
    : previousBudget;
  const visibleActive = !!visibleEvent && isActiveEvent(visibleEvent.status);
  const visibleBudgetReady =
    !canViewBudget || visibleBudget?.initialized === true;
  const budgetMissing =
    !!visibleBudget &&
    !visibleBudget.error &&
    visibleBudget.initialized === false;
  const actionsBlocked = updating || !!error || !!currentBudget?.error;
  useEffect(() => {
    if (!allowed) return;
    let current = true;
    getEvent(eventId)
      .then((item) => {
        if (!current) return;
        setResult({ attempt, eventId, event: item });
        onEventLoaded(item);
      })
      .catch((error: unknown) => {
        if (current)
          setResult((previous) => ({
            attempt,
            eventId,
            event: previous?.eventId === eventId ? previous.event : undefined,
            error: apiErrorMessage(error),
          }));
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
          setBudgetStatus((previous) => ({
            key: budgetKey,
            initialized: previous?.key.startsWith(`${eventId}:`)
              ? previous.initialized
              : undefined,
            error: apiErrorMessage(error),
          }));
      });
    return () => {
      current = false;
    };
  }, [eventId, allowed, active, canViewBudget, budgetKey]);
  useEffect(() => {
    if (!attempt || notifiedAttempt.current === attempt || eventLoading) return;
    if (active && canViewBudget && !currentBudget) return;
    if (
      active &&
      can('asignaciones.ver') &&
      inventoryResult?.revision !== attempt
    )
      return;
    if (
      active &&
      can('asignaciones.ver') &&
      inventoryResult?.inventoryChecked !==
        (budgetReady && can('asignaciones.crear') && can('inventario.ver'))
    )
      return;
    if (
      active &&
      can('servicios_proveedor.ver') &&
      servicesResult?.revision !== attempt
    )
      return;
    const errors = [
      error && `Evento: ${error}`,
      currentBudget?.error && `Presupuesto: ${currentBudget.error}`,
      ...(active && can('asignaciones.ver')
        ? (inventoryResult?.errors ?? [])
        : []),
      ...(active && can('servicios_proveedor.ver')
        ? (servicesResult?.errors ?? [])
        : []),
    ].filter(Boolean);
    notifiedAttempt.current = attempt;
    // Publish the coordinated results once after all independent requests settle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCommittedAttempt(attempt);
    if (errors.length) {
      notify(
        `No se pudo actualizar toda la información. ${errors.join(' ')}`,
        'error',
      );
    } else {
      setHasChanges(false);
      notify('Las asignaciones del evento se consultaron correctamente.');
    }
  }, [
    attempt,
    eventLoading,
    active,
    canViewBudget,
    currentBudget,
    can,
    inventoryResult,
    servicesResult,
    error,
    notify,
    budgetReady,
  ]);
  function budgetChanged() {
    setBudgetRevision((value) => value + 1);
  }
  function assignmentChanged() {
    setHasChanges(true);
    budgetChanged();
  }
  function refresh() {
    setVisibleSnapshot({ event: visibleEvent, budget: visibleBudget });
    setAttempt((value) => value + 1);
    budgetChanged();
  }
  function updateEvent() {
    if (!hasChanges) {
      feedback.guide(
        'Para actualizar el evento, primero debes añadir o liberar un recurso, o asignar un servicio.',
        'Revisa las asignaciones del evento',
        'error',
      );
      return;
    }
    refresh();
  }
  return (
    <ProviderDialogShell
      title={
        visibleEvent
          ? `Asignaciones · ${visibleEvent.name}`
          : 'Asignaciones del evento'
      }
      busy={inventoryBusy}
      onClose={onClose}
      size="wide"
      stickyFooter={false}
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
      <FeedbackMessages feedback={feedback} />
      <div className="grid min-w-0 gap-6">
        {!allowed ? (
          <p role="status">No tienes permiso para consultar este evento.</p>
        ) : error && !visibleEvent ? (
          <div>
            <ErrorMessage message={error} />
            <Button className="mt-4" onClick={refresh}>
              Reintentar evento
            </Button>
          </div>
        ) : !visibleEvent ? (
          <LoadingState label="Cargando información del evento…" />
        ) : (
          <>
            {error && !awaitingCommit && (
              <div>
                <ErrorMessage message={error} />
                <Button className="mt-3" variant="secondary" onClick={refresh}>
                  Reintentar evento
                </Button>
              </div>
            )}
            <Card
              className="min-w-0"
              style={{
                backgroundColor:
                  'color-mix(in srgb, var(--color-sky-blue) 20%, var(--evoria-surface))',
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <StatusBadge
                    status={assignmentEventStatusLabels[visibleEvent.status]}
                  />
                  <h3 className="mt-2 break-words text-xl font-bold">
                    {visibleEvent.name}
                  </h3>
                  {visibleEvent.description && (
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted">
                      {visibleEvent.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="secondary"
                  disabled={inventoryBusy || updating}
                  onClick={updateEvent}
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
                      {assignmentEventDate(visibleEvent.startAt)}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <AssignmentIcon name="cronograma" small />
                  <div>
                    <dt className="text-xs text-muted">Fin</dt>
                    <dd className="mt-1 font-semibold">
                      {assignmentEventDate(visibleEvent.endAt)}
                    </dd>
                  </div>
                </div>
                {visibleEvent.location && (
                  <div className="flex min-w-0 items-start gap-3">
                    <AssignmentIcon name="empresas" small />
                    <div className="min-w-0">
                      <dt className="text-xs text-muted">Lugar</dt>
                      <dd className="mt-1 break-words font-semibold">
                        {visibleEvent.location}
                      </dd>
                    </div>
                  </div>
                )}
                {visibleEvent.type && (
                  <div className="flex min-w-0 items-start gap-3">
                    <AssignmentIcon name="eventos" small />
                    <div className="min-w-0">
                      <dt className="text-xs text-muted">Tipo</dt>
                      <dd className="mt-1 break-words font-semibold">
                        {visibleEvent.type}
                      </dd>
                    </div>
                  </div>
                )}
              </dl>
            </Card>
            {!visibleActive ? (
              <Card>
                <p role="status" className="text-sm text-muted">
                  Este evento ya no está activo. Cierra esta ventana y elige
                  otro evento para gestionar asignaciones.
                </p>
              </Card>
            ) : (
              <>
                {canViewBudget ? (
                  !visibleBudget ? (
                    <LoadingState label="Comprobando requisitos del presupuesto…" />
                  ) : visibleBudget.error ? (
                    <Card>
                      <ErrorMessage message={visibleBudget.error} />
                      <Button
                        className="mt-3"
                        variant="secondary"
                        onClick={budgetChanged}
                      >
                        Reintentar presupuesto
                      </Button>
                    </Card>
                  ) : (
                    budgetMissing && (
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
                      visibleBudgetReady={visibleBudgetReady}
                      budgetMissing={budgetMissing}
                      updating={actionsBlocked}
                      refreshRevision={attempt}
                      committedRevision={committedAttempt}
                      onRefreshingChange={setInventoryRefreshing}
                      onRefreshResult={setInventoryResult}
                      onChanged={assignmentChanged}
                      onBusyChange={setInventoryBusy}
                    />
                  )}
                  {can('servicios_proveedor.ver') && (
                    <ProviderServices
                      key={`providers:${eventId}`}
                      event={visibleEvent}
                      inDialog
                      budgetReady={visibleBudgetReady}
                      budgetMissing={budgetMissing}
                      updating={actionsBlocked}
                      refreshRevision={attempt}
                      committedRevision={committedAttempt}
                      onRefreshingChange={setServicesRefreshing}
                      onRefreshResult={setServicesResult}
                      onChanged={assignmentChanged}
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
