'use client';
import { useEffect, useState } from 'react';
import type { EventProviderService } from '@evoria/contracts';
import type { EventItem } from '../../services/events.service';
import {
  getProviderServices,
  cancelProviderService,
  resendProviderService,
} from '../../services/providers.service';
import { useAuth } from '../../hooks/useAuth';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingState } from '../ui/LoadingState';
import { ProviderServiceDialog } from './ProviderServiceDialog';
import { ConfirmProviderAction } from './ConfirmProviderAction';
import { apiErrorMessage } from '../../services/api';
import { FeedbackMessages, useFeedback } from '../ui/Feedback';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { AssignmentIcon } from '../resources/AssignmentIcon';

const cop = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});
const statusLabels = {
  pendiente: 'Pendiente de respuesta',
  aceptado_sin_saldo: 'Aceptado, pendiente de saldo',
  confirmado: 'Confirmado',
  rechazado: 'Rechazado',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
};
export function ProviderServices({
  event,
  updating = false,
  refreshRevision = 0,
  committedRevision = refreshRevision,
  onRefreshingChange,
  onRefreshResult,
  onChanged,
  inDialog = false,
  readOnly = false,
  showItems = true,
}: {
  event: EventItem;
  updating?: boolean;
  refreshRevision?: number;
  committedRevision?: number;
  onRefreshingChange?: (refreshing: boolean) => void;
  onRefreshResult?: (result: { revision: number; errors: string[] }) => void;
  onChanged?: () => void;
  inDialog?: boolean;
  readOnly?: boolean;
  showItems?: boolean;
}) {
  const { can, user } = useAuth();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    items?: EventProviderService[];
    previousItems?: EventProviderService[];
    refreshRevision: number;
    error?: string;
  }>();
  const [panel, setPanel] = useState(false);
  const [cancelling, setCancelling] = useState<EventProviderService | null>(
    null,
  );
  const [resending, setResending] = useState<EventProviderService | null>(null);
  const feedback = useFeedback();
  const key = `${event.id}:${revision}:${refreshRevision}`;
  useEffect(() => {
    if (result?.key !== key) return;
    onRefreshResult?.({
      revision: refreshRevision,
      errors: result.error ? [`Servicios: ${result.error}`] : [],
    });
  }, [key, result, refreshRevision, onRefreshResult]);
  useEffect(() => {
    onRefreshingChange?.(result?.key !== key);
    return () => onRefreshingChange?.(false);
  }, [key, result?.key, onRefreshingChange]);
  useEffect(() => {
    if (!showItems) {
      Promise.resolve().then(() => {
        setResult({ key, items: [], refreshRevision });
      });
      return;
    }
    let active = true;
    getProviderServices(event.id, true)
      .then((items) => {
        if (active)
          setResult((previous) => ({
            key,
            items,
            refreshRevision,
            previousItems:
              previous?.refreshRevision === refreshRevision
                ? previous.previousItems
                : previous?.items,
          }));
      })
      .catch((err: unknown) => {
        if (active)
          setResult((previous) => ({
            key,
            refreshRevision,
            previousItems:
              previous?.refreshRevision === refreshRevision
                ? previous.previousItems
                : previous?.items,
            items: previous?.key.startsWith(`${event.id}:`)
              ? previous.items
              : undefined,
            error: apiErrorMessage(err),
          }));
      });
    return () => {
      active = false;
    };
  }, [event.id, key, refreshRevision, showItems]);
  const hasPendingResponse =
    result?.key === key &&
    result.items?.some(
      (item) =>
        item.status === 'pendiente' || item.status === 'aceptado_sin_saldo',
    );
  useEffect(() => {
    if (!showItems || !hasPendingResponse || updating) return;
    let active = true;
    let inFlight = false;
    const refreshPending = async () => {
      if (inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        const items = await getProviderServices(event.id, true);
        if (!active) return;
        setResult((previous) =>
          previous?.key === key ? { ...previous, items } : previous,
        );
        window.dispatchEvent(new Event('evoria-alerts-changed'));
      } catch {
        // Keep the last known state; the next focus or interval retries.
      } finally {
        inFlight = false;
      }
    };
    const timer = window.setInterval(refreshPending, 15000);
    window.addEventListener('focus', refreshPending);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshPending);
    };
  }, [event.id, key, hasPendingResponse, showItems, updating]);
  const items = result?.key.startsWith(`${event.id}:`)
    ? result.refreshRevision > committedRevision
      ? result.previousItems
      : result.items
    : undefined;
  const error = result?.key === key && !updating ? result.error : undefined;
  const cancelled = event.status === 'cancelado';
  function saved(message: string) {
    setPanel(false);
    setCancelling(null);
    setResending(null);
    feedback.notify(message);
    setRevision((value) => value + 1);
    onChanged?.();
  }
  return (
    <section
      aria-label="Servicios de proveedores"
      className={
        inDialog
          ? 'min-w-0 self-stretch'
          : 'min-w-0 border-l-4 border-teal pl-3'
      }
    >
      <Card className={`min-w-0 ${inDialog ? 'h-full' : ''}`}>
        <FeedbackMessages feedback={feedback} />
        <div className="grid gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                {inDialog && <AssignmentIcon name="provedores" />}
                <h3
                  className={
                    inDialog ? 'text-xl font-bold' : 'text-2xl font-bold'
                  }
                >
                  Servicios de proveedores
                </h3>
              </div>
              <p className="mt-2 text-sm text-muted">
                Solicitudes y servicios pactados para este evento.
              </p>
            </div>
            {!readOnly &&
              can('servicios_proveedor.crear') &&
              can('proveedores.ver') && (
                <Button
                  className="disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={cancelled || updating}
                  data-tour={inDialog ? 'assignment-service-open' : undefined}
                  onClick={() => setPanel(true)}
                >
                  {inDialog
                    ? '+ Asignar servicio'
                    : 'Asignar servicio de proveedor'}
                </Button>
              )}
          </div>
          {cancelled && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              {readOnly
                ? 'Evento cancelado: puedes consultar sus acuerdos históricos.'
                : 'Evento cancelado: puedes consultar o cancelar solicitudes existentes; no crear otras.'}
            </p>
          )}
          {!readOnly &&
            !cancelled &&
            can('servicios_proveedor.crear') &&
            !can('proveedores.ver') && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                Necesitas permiso para consultar proveedores antes de asignar un
                servicio.
              </p>
            )}
          <div
            className={
              inDialog
                ? 'flex items-start gap-3 rounded-xl border border-sky-blue bg-sky-blue/25 p-4 text-sm text-muted'
                : 'text-sm text-muted'
            }
          >
            {inDialog && <AssignmentIcon name="alerta" small />}
            <p>
              La solicitud queda pendiente hasta que el proveedor responda. Solo
              un servicio confirmado cuenta como gasto del presupuesto.
            </p>
          </div>
          {error && (
            <>
              <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
                {error}
              </p>
              <Button onClick={() => setRevision((value) => value + 1)}>
                Reintentar servicios
              </Button>
            </>
          )}
          {showItems &&
            (!items && !error ? (
              <LoadingState label="Cargando servicios de proveedores…" />
            ) : items?.length === 0 ? (
              inDialog ? (
                <div className="grid justify-items-center gap-4 py-5">
                  <AssignmentIcon name="provedores" />
                  <EmptyState title="No hay servicios de proveedores registrados para este evento" />
                </div>
              ) : (
                <p className="py-5 text-muted">
                  No hay servicios de proveedores registrados para este evento.
                </p>
              )
            ) : items ? (
              <div
                className={
                  inDialog
                    ? 'grid gap-3'
                    : 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'
                }
              >
                {items.map((item) => (
                  <article
                    key={item.id}
                    className="flex min-w-0 flex-col rounded-xl border border-sky-blue p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="break-words text-lg font-bold">
                        {item.serviceName}
                      </h3>
                      <StatusBadge status={statusLabels[item.status]} />
                    </div>
                    <p className="mt-3 break-words font-semibold text-muted">
                      {item.provider.name}
                    </p>
                    {item.provider.status === 'inactivo' && (
                      <p className="mt-1 text-xs text-muted">
                        Proveedor inactivo · Acuerdo histórico
                      </p>
                    )}
                    {item.description && (
                      <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                        {item.description}
                      </p>
                    )}
                    <p className="mt-4 text-sm text-muted">
                      Desde {item.startDate} {item.startTime}
                      {item.endDate
                        ? ` hasta ${item.endDate} ${item.endTime ?? ''}`
                        : ''}
                    </p>
                    <p className="my-4 break-words text-xl font-bold">
                      {cop.format(item.agreedAmountCop)}
                    </p>
                    {item.status === 'pendiente' && (
                      <p className="text-xs text-muted">
                        Esperando respuesta del proveedor hasta{' '}
                        {item.responseExpiresAt
                          ? new Date(item.responseExpiresAt).toLocaleString(
                              'es-CO',
                            )
                          : 'el vencimiento de la solicitud'}
                        .
                        {item.emailDelivery === 'failed' &&
                          ' El correo no se pudo enviar; intenta reenviarlo.'}
                        {item.emailDelivery === 'queued' &&
                          ' El correo está en cola de envío.'}
                      </p>
                    )}
                    {item.status === 'aceptado_sin_saldo' && (
                      <p className="text-xs text-muted">
                        El proveedor aceptó. El servicio se confirmará cuando
                        haya presupuesto y saldo suficientes.
                      </p>
                    )}
                    {item.status !== 'confirmado' &&
                      item.status !== 'pendiente' &&
                      item.status !== 'aceptado_sin_saldo' && (
                        <p className="text-xs text-muted">
                          Histórico · No cuenta como gasto.
                        </p>
                      )}
                    {!readOnly &&
                      (item.status === 'pendiente' ||
                        item.status === 'aceptado_sin_saldo' ||
                        item.status === 'confirmado') && (
                        <div className="mt-auto flex flex-wrap gap-2">
                          {item.status === 'pendiente' &&
                            can('servicios_proveedor.crear') &&
                            can('proveedores.ver') &&
                            (item.assignedBy === user?.id ||
                              event.responsibleUserId === user?.id) && (
                              <Button
                                variant="secondary"
                                disabled={updating}
                                onClick={() => setResending(item)}
                              >
                                Reenviar correo
                              </Button>
                            )}
                          {can('servicios_proveedor.cancelar') &&
                            (item.assignedBy === user?.id ||
                              event.responsibleUserId === user?.id) && (
                              <Button
                                variant="ghost"
                                disabled={updating}
                                onClick={() => setCancelling(item)}
                              >
                                {item.status === 'confirmado'
                                  ? 'Cancelar servicio'
                                  : 'Cancelar solicitud'}
                              </Button>
                            )}
                        </div>
                      )}
                  </article>
                ))}
              </div>
            ) : null)}
          {panel && (
            <ProviderServiceDialog
              event={event}
              onClose={() => setPanel(false)}
              onSaved={() =>
                saved('Solicitud enviada. Espera la respuesta del proveedor.')
              }
            />
          )}
          {resending && (
            <ConfirmProviderAction
              title="Reenviar solicitud"
              description={`¿Reenviar al proveedor la solicitud de ${resending.serviceName}? El enlace anterior dejará de funcionar y comenzará un nuevo plazo de 24 horas.`}
              confirmationText={null}
              action={() => resendProviderService(event.id, resending.id)}
              onError={(error) =>
                feedback.notify(apiErrorMessage(error), 'error')
              }
              onClose={() => setResending(null)}
              onSaved={() =>
                saved('Nueva solicitud de confirmación en cola de envío.')
              }
            />
          )}
          {cancelling && (
            <ConfirmProviderAction
              title="Cancelar servicio de proveedor"
              description={`¿Cancelar ${cancelling.serviceName}? La solicitud permanecerá en el historial. Si estaba confirmada, su valor dejará de contar como gasto.`}
              action={() => cancelProviderService(event.id, cancelling.id)}
              onError={(error) =>
                feedback.notify(apiErrorMessage(error), 'error')
              }
              onClose={() => setCancelling(null)}
              onSaved={() =>
                saved('Servicio cancelado. Puedes consultarlo en el historial.')
              }
            />
          )}
        </div>
      </Card>
    </section>
  );
}
