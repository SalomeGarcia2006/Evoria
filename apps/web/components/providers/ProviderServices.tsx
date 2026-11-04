'use client';
import { useEffect, useState } from 'react';
import {
  PROVIDER_SERVICE_STATUSES,
  type EventProviderService,
} from '@evoria/contracts';
import type { EventItem } from '../../services/events.service';
import {
  getProviderServices,
  cancelProviderService,
} from '../../services/providers.service';
import { useAuth } from '../../hooks/useAuth';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { DataTable } from '../ui/DataTable';
import { LoadingState } from '../ui/LoadingState';
import { ErrorMessage } from '../ui/ErrorMessage';
import { ProviderServiceDialog } from './ProviderServiceDialog';
import { ConfirmProviderAction } from './ConfirmProviderAction';
import { apiErrorMessage } from '../../services/api';
import { FeedbackMessages, useFeedback } from '../ui/Feedback';

const cop = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});
export function ProviderServices({
  event,
  budgetReady = true,
  onChanged,
}: {
  event: EventItem;
  budgetReady?: boolean;
  onChanged?: () => void;
}) {
  const { can } = useAuth();
  const [history, setHistory] = useState(true);
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
  const key = `${event.id}:${history}:${revision}`;
  useEffect(() => {
    let active = true;
    getProviderServices(event.id, history)
      .then((items) => {
        if (active) setResult({ key, items });
      })
      .catch((err: unknown) => {
        if (active)
          setResult({
            key,
            error: apiErrorMessage(err),
          });
      });
    return () => {
      active = false;
    };
  }, [event.id, history, key]);
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
      className="min-w-0 border-l-4 border-teal pl-3"
    >
      <Card className="min-w-0">
        <FeedbackMessages feedback={feedback} />
        <div className="grid gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Servicios de proveedores</h2>
              <p className="mt-2 text-sm text-teal">
                Acuerdos y valores pactados para este evento.
              </p>
            </div>
            {can('servicios_proveedor.crear') && can('proveedores.ver') && (
              <Button
                disabled={cancelled || !budgetReady}
                onClick={() => setPanel('create')}
              >
                Asignar servicio de proveedor
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
              presupuesto del evento. Revisa el resumen financiero de esta
              pantalla.
            </p>
          )}
          <p className="text-sm text-teal">
            Un acuerdo confirmado cuenta como gasto del presupuesto. Al
            cancelarlo, deja de contar y se conserva en el historial.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={history}
              onChange={(e) => setHistory(e.target.checked)}
            />
            Incluir historial de cancelados
          </label>
          {error ? (
            <>
              <ErrorMessage message={error} />
              <Button onClick={() => setRevision((value) => value + 1)}>
                Reintentar servicios
              </Button>
            </>
          ) : !items ? (
            <LoadingState label="Cargando servicios de proveedores…" />
          ) : !items.length ? (
            <p className="py-5 text-teal">
              No hay servicios de proveedores{' '}
              {history ? 'registrados' : 'confirmados'} para este evento.
            </p>
          ) : (
            <DataTable
              rows={items}
              rowKey={(item) => item.id}
              columns={[
                {
                  key: 'provider',
                  header: 'Proveedor',
                  render: (item) => (
                    <div>
                      <strong>{item.provider.name}</strong>
                      {item.provider.status === 'inactivo' && (
                        <p className="text-xs text-slate-500">
                          Proveedor inactivo · Histórico
                        </p>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'service',
                  header: 'Servicio acordado',
                  render: (item) => (
                    <div className="max-w-sm break-words">
                      <strong>{item.serviceName}</strong>
                      {item.description && (
                        <p className="mt-1 whitespace-pre-wrap text-teal">
                          {item.description}
                        </p>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'date',
                  header: 'Fecha acordada',
                  render: (item) => (
                    <div className="whitespace-nowrap">
                      {item.startDate} {item.startTime}
                      {item.endDate && (
                        <p>
                          Hasta {item.endDate} {item.endTime}
                        </p>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'amount',
                  header: 'Total (COP)',
                  render: (item) => (
                    <span className="whitespace-nowrap">
                      {cop.format(item.agreedAmountCop)} COP
                    </span>
                  ),
                },
                {
                  key: 'status',
                  header: 'Estado',
                  render: (item) => (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${item.status === PROVIDER_SERVICE_STATUSES[0] ? 'bg-sky-blue text-navy' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {item.status === 'confirmado'
                        ? 'Confirmado'
                        : 'Cancelado'}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  header: 'Acciones',
                  render: (item) =>
                    item.status === 'confirmado' ? (
                      <div className="flex gap-2">
                        {can('servicios_proveedor.editar') &&
                          !cancelled &&
                          budgetReady && (
                            <Button
                              variant="ghost"
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
                    ) : (
                      '—'
                    ),
                },
              ]}
            />
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
