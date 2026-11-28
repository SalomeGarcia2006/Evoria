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
  aceptado_sin_saldo: 'Aceptado, pendiente de presupuesto',
  confirmado: 'Confirmado',
  rechazado: 'Rechazado',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
} as const;
export function ProviderServices({
  event,
  budgetMissing = false,
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
  budgetMissing?: boolean;
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
  const { can } = useAuth();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    items?: EventProviderService[];
    previousItems?: EventProviderService[];
    refreshRevision: number;
    error?: string;
  }>();
  const [panel, setPanel] = useState<'create' | null>(null);
  const [cancelling, setCancelling] = useState<EventProviderService | null>(
    null,
  );
  const [resending, setResending] = useState<string | null>(null);
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
  const items = result?.key.startsWith(`${event.id}:`)
    ? result.refreshRevision > committedRevision
      ? result.previousItems
      : result.items
    : undefined;
  const hasOpenRequests = items?.some(
    (item) =>
      item.status === 'pendiente' || item.status === 'aceptado_sin_saldo',
  );
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible')
        setRevision((value) => value + 1);
    };
    window.addEventListener('focus', refresh);
    const timer = hasOpenRequests ? window.setInterval(refresh, 15000) : null;
    return () => {
      window.removeEventListener('focus', refresh);
      if (timer !== null) window.clearInterval(timer);
    };
  }, [hasOpenRequests]);
  const error = result?.key === key && !updating ? result.error : undefined;
  const cancelled = event.status === 'cancelado';
  function saved(message: string) {
    setPanel(null);
    setCancelling(null);
    feedback.notify(message);
    setRevision((value) => value + 1);
    onChanged?.();
  }
  async function resend(item: EventProviderService) {
    if (resending) return;
    setResending(item.id);
    feedback.dismiss();
    try {
      const updated = await resendProviderService(event.id, item.id);
      feedback.notify(
        updated.emailDelivery === 'sent'
          ? 'Correo reenviado al proveedor.'
          : updated.emailDelivery === 'failed'
            ? 'El correo no se pudo enviar. Comprueba Brevo y vuelve a intentar.'
            : 'Reenvío solicitado. El correo está pendiente de entrega.',
      );
      setRevision((value) => value + 1);
    } catch (error) {
      feedback.notify(apiErrorMessage(error), 'error');
    } finally {
      setResending(null);
    }
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
                Solicitudes enviadas a proveedores y servicios confirmados para
                este evento.
              </p>
            </div>
            {!readOnly &&
              can('servicios_proveedor.crear') &&
              can('proveedores.ver') && (
                <Button
                  className="disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={cancelled || updating}
                  data-tour={inDialog ? 'assignment-service-open' : undefined}
                  onClick={() => setPanel('create')}
                >
                  {inDialog
                    ? '+ Solicitar servicio'
                    : 'Solicitar servicio al proveedor'}
                </Button>
              )}
          </div>
          {cancelled && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              {readOnly
                ? 'Evento cancelado: puedes consultar sus acuerdos históricos.'
                : 'Evento cancelado: puedes consultar o cancelar solicitudes existentes; no crear nuevas.'}
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
          {!readOnly && !cancelled && budgetMissing && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Puedes solicitar confirmación ahora. Si el proveedor acepta, el
              servicio quedará pendiente hasta que inicies el presupuesto del
              evento y haya saldo.
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
              El proveedor acepta o rechaza desde el correo. Solo un servicio
              confirmado cuenta como gasto del presupuesto.
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
                        {item.emailDelivery === 'sent'
                          ? 'Correo enviado. Esperando respuesta del proveedor.'
                          : item.emailDelivery === 'failed'
                            ? 'No se pudo enviar el correo. Puedes reenviarlo.'
                            : 'Correo en cola de envío.'}
                      </p>
                    )}
                    {item.status === 'aceptado_sin_saldo' && (
                      <p className="text-xs text-muted">
                        El proveedor aceptó. Falta saldo para confirmar el
                        servicio.
                      </p>
                    )}
                    {item.status === 'rechazado' && item.rejectionReason && (
                      <p className="text-xs text-muted">
                        Motivo: {item.rejectionReason}
                      </p>
                    )}
                    {item.status === 'cancelado' ? (
                      <p className="text-xs text-muted">
                        Histórico · No cuenta como gasto.
                      </p>
                    ) : ['rechazado', 'vencido'].includes(
                        item.status,
                      ) ? null : (
                      <div className="mt-auto flex flex-wrap gap-2">
                        {!readOnly &&
                          item.status === 'pendiente' &&
                          can('servicios_proveedor.crear') &&
                          can('proveedores.ver') && (
                            <Button
                              variant="secondary"
                              disabled={updating || resending === item.id}
                              onClick={() => void resend(item)}
                            >
                              {resending === item.id
                                ? 'Reenviando…'
                                : 'Reenviar correo'}
                            </Button>
                          )}
                        {!readOnly && can('servicios_proveedor.cancelar') && (
                          <Button
                            variant="ghost"
                            disabled={updating}
                            onClick={() => setCancelling(item)}
                          >
                            Cancelar servicio
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
              onClose={() => setPanel(null)}
              onSaved={(service) =>
                saved(
                  service.emailDelivery === 'sent'
                    ? 'Correo enviado al proveedor. Esperando su respuesta.'
                    : service.emailDelivery === 'failed'
                      ? 'Solicitud creada, pero el correo no se pudo enviar. Usa Reenviar correo.'
                      : 'Solicitud creada. El correo está en cola de envío.',
                )
              }
            />
          )}
          {cancelling && (
            <ConfirmProviderAction
              title="Cancelar servicio de proveedor"
              description={
                cancelling.status === 'confirmado'
                  ? `¿Cancelar ${cancelling.serviceName}? Su valor dejará de contar como gasto del presupuesto. El servicio permanecerá en el historial.`
                  : `¿Cancelar la solicitud de ${cancelling.serviceName}? El proveedor ya no podrá responder el enlace. La solicitud permanecerá en el historial.`
              }
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
