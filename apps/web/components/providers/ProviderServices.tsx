'use client';
import { useEffect, useState } from 'react';
import type { EventProviderService } from '@evoria/contracts';
import type { EventItem } from '../../services/events.service';
import {
  getProviderServices,
  cancelProviderService,
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
export function ProviderServices({
  event,
  budgetReady = true,
  onChanged,
  inDialog = false,
}: {
  event: EventItem;
  budgetReady?: boolean;
  onChanged?: () => void;
  inDialog?: boolean;
}) {
  const { can } = useAuth();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    items?: EventProviderService[];
    error?: string;
  }>();
  const [panel, setPanel] = useState<EventProviderService | 'create' | null>(
    null,
  );
  const [cancelling, setCancelling] = useState<EventProviderService | null>(
    null,
  );
  const feedback = useFeedback();
  const { notify } = feedback;
  const key = `${event.id}:${revision}`;
  useEffect(() => {
    let active = true;
    getProviderServices(event.id, true)
      .then((items) => {
        if (active) setResult({ key, items });
      })
      .catch((err: unknown) => {
        if (active) notify(apiErrorMessage(err), 'error');
        if (active)
          setResult({
            key,
            error: apiErrorMessage(err),
          });
      });
    return () => {
      active = false;
    };
  }, [event.id, key, notify]);
  const items = result?.key === key ? result.items : undefined;
  const error = result?.key === key ? result.error : undefined;
  const cancelled = event.status === 'cancelado';
  function saved(message: string) {
    setPanel(null);
    setCancelling(null);
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
              <p className="mt-2 text-sm text-teal">
                Acuerdos y valores pactados para este evento.
              </p>
            </div>
            {can('servicios_proveedor.crear') && can('proveedores.ver') && (
              <Button
                className="disabled:cursor-not-allowed disabled:opacity-50"
                disabled={cancelled || !budgetReady}
                onClick={() => setPanel('create')}
              >
                {inDialog
                  ? '+ Asignar servicio'
                  : 'Asignar servicio de proveedor'}
              </Button>
            )}
          </div>
          {cancelled && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Evento cancelado: puedes consultar o cancelar acuerdos existentes;
              no crear ni editar.
            </p>
          )}
          {!cancelled && !budgetReady && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              No puedes crear ni editar acuerdos hasta consultar e iniciar el
              presupuesto del evento. Revísalo desde Presupuestos y luego vuelve
              a comprobar los requisitos de asignación.
            </p>
          )}
          <div
            className={
              inDialog
                ? 'flex items-start gap-3 rounded-xl border border-sky-blue bg-sky-blue/25 p-4 text-sm text-teal'
                : 'text-sm text-teal'
            }
          >
            {inDialog && <AssignmentIcon name="alerta" small />}
            <p>
              Un acuerdo confirmado cuenta como gasto del presupuesto. Al
              cancelarlo, deja de contar y se conserva en el historial.
            </p>
          </div>
          {error ? (
            <>
              <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
                {error}
              </p>
              <Button onClick={() => setRevision((value) => value + 1)}>
                Reintentar servicios
              </Button>
            </>
          ) : !items ? (
            <LoadingState label="Cargando servicios de proveedores…" />
          ) : !items.length ? (
            inDialog ? (
              <div className="grid justify-items-center gap-4 py-5">
                <AssignmentIcon name="provedores" />
                <EmptyState title="No hay servicios de proveedores registrados para este evento" />
              </div>
            ) : (
              <p className="py-5 text-teal">
                No hay servicios de proveedores registrados para este evento.
              </p>
            )
          ) : (
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
                    <StatusBadge
                      status={
                        item.status === 'confirmado'
                          ? 'Confirmado'
                          : 'Cancelado'
                      }
                    />
                  </div>
                  <p className="mt-3 break-words font-semibold text-teal">
                    {item.provider.name}
                  </p>
                  {item.provider.status === 'inactivo' && (
                    <p className="mt-1 text-xs text-teal">
                      Proveedor inactivo · Acuerdo histórico
                    </p>
                  )}
                  {item.description && (
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                      {item.description}
                    </p>
                  )}
                  <p className="mt-4 text-sm text-teal">
                    Desde {item.startDate} {item.startTime}
                    {item.endDate
                      ? ` hasta ${item.endDate} ${item.endTime ?? ''}`
                      : ''}
                  </p>
                  <p className="my-4 break-words text-xl font-bold">
                    {cop.format(item.agreedAmountCop)}
                  </p>
                  {item.status === 'cancelado' ? (
                    <p className="text-xs text-teal">
                      Histórico · No cuenta como gasto.
                    </p>
                  ) : (
                    <div className="mt-auto flex flex-wrap gap-2">
                      {can('servicios_proveedor.editar') &&
                        !cancelled &&
                        budgetReady && (
                          <Button
                            variant="secondary"
                            onClick={() => setPanel(item)}
                          >
                            Editar servicio
                          </Button>
                        )}
                      {can('servicios_proveedor.cancelar') && (
                        <Button
                          variant="ghost"
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
          )}
          {panel && (
            <ProviderServiceDialog
              event={event}
              service={panel === 'create' ? undefined : panel}
              onClose={() => setPanel(null)}
              onSaved={() => saved('Servicio guardado correctamente.')}
            />
          )}
          {cancelling && (
            <ConfirmProviderAction
              title="Cancelar servicio de proveedor"
              description={`¿Cancelar ${cancelling.serviceName}? Su valor dejará de contar como gasto del presupuesto. El acuerdo permanecerá en el historial.`}
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
