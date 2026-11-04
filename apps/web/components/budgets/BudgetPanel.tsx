'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { BudgetRequest, EventBudgetDetail } from '@evoria/contracts';
import { useAuth } from '../../hooks/useAuth';
import {
  getEventBudget,
  getBudgetAuthorizations,
} from '../../services/presupuestos.service';
import { apiErrorMessage } from '../../services/api';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { DataTable } from '../ui/DataTable';
import { ErrorMessage } from '../ui/ErrorMessage';
import { LoadingState } from '../ui/LoadingState';
import { BudgetAmountsView, cop, requestLabels } from './BudgetAmountsView';
import { BudgetActionDialog, type BudgetAction } from './BudgetActionDialog';

export function BudgetPanel({
  eventId,
  revision = 0,
  onChanged,
  compact = false,
}: {
  eventId: string;
  revision?: number;
  onChanged?: () => void;
  compact?: boolean;
}) {
  const { user, can } = useAuth();
  const allowed = can('presupuestos.ver');
  const canApprove = can('presupuestos.aprobar');
  const [attempt, setAttempt] = useState(0);
  const key = `${eventId}:${revision}:${attempt}`;
  const [result, setResult] = useState<{
    owner: typeof user;
    key: string;
    data?: EventBudgetDetail;
    error?: string;
  }>();
  const [eligible, setEligible] = useState<string[]>([]);
  const [approvalError, setApprovalError] = useState('');
  const [action, setAction] = useState<BudgetAction | null>(null);
  const [notice, setNotice] = useState('');
  const [preparing, setPreparing] = useState(false);
  useEffect(() => {
    if (!allowed || !user) return;
    let active = true;
    getEventBudget(eventId)
      .then((data) => {
        if (active) setResult({ owner: user, key, data });
      })
      .catch((error: unknown) => {
        if (active)
          setResult((previous) => ({
            owner: user,
            key,
            data: previous?.owner === user ? previous.data : undefined,
            error: apiErrorMessage(error),
          }));
      });
    if (canApprove)
      getBudgetAuthorizations()
        .then((items) => {
          if (active) {
            setEligible(
              items
                .filter(
                  (item) =>
                    item.eventId === eventId && item.requestedBy !== user.id,
                )
                .map((item) => item.id),
            );
            setApprovalError('');
          }
        })
        .catch((error: unknown) => {
          if (active) {
            setEligible([]);
            setApprovalError(apiErrorMessage(error));
          }
        });
    return () => {
      active = false;
    };
  }, [allowed, canApprove, eventId, key, user]);
  const current = result?.owner === user ? result : undefined;
  const budget = current?.data;
  const loading = current?.key !== key;
  const unavailable = loading || !!current?.error;
  function refresh() {
    setAttempt((value) => value + 1);
    onChanged?.();
  }
  async function decide(kind: 'approve' | 'reject', request: BudgetRequest) {
    setPreparing(true);
    try {
      const fresh = await getEventBudget(eventId);
      setResult({ owner: user, key, data: fresh });
      const pending = fresh.requests.find(
        (item) => item.id === request.id && item.status === 'pendiente',
      );
      if (!pending || fresh.eventStatus === 'cancelado') {
        setNotice(
          'La solicitud ya fue decidida o el evento está cancelado. Consulta el historial actualizado.',
        );
        refresh();
        return;
      }
      setAction({ kind, request: pending });
    } catch (error) {
      setNotice(apiErrorMessage(error));
    } finally {
      setPreparing(false);
    }
  }
  if (!allowed) return null;
  return (
    <Card className="min-w-0">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Presupuesto del evento</h2>
          {budget && <p className="mt-2 text-teal">{budget.eventName}</p>}
        </div>
        <Button
          variant="secondary"
          disabled={loading || preparing}
          onClick={refresh}
        >
          Actualizar presupuesto
        </Button>
      </div>
      {notice && (
        <p role="status" className="my-4 rounded-lg bg-sky-blue p-3">
          {notice}
        </p>
      )}
      {current?.error && <ErrorMessage message={current.error} />}
      {current?.error && budget && (
        <p className="my-3 text-sm text-amber-900">
          Se muestran los últimos datos consultados. Actualiza el presupuesto
          para habilitar nuevas operaciones.
        </p>
      )}
      {loading && <LoadingState label="Actualizando presupuesto…" />}
      {budget && (
        <div className="grid gap-5">
          {!budget.initialized ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-bold">Falta iniciar el presupuesto</h3>
              <p className="mt-2 text-sm">
                No se pueden asignar nuevas unidades de inventario ni servicios
                de proveedores hasta registrar el presupuesto inicial.
              </p>
              {can('presupuestos.editar') &&
                budget.eventStatus !== 'cancelado' && (
                  <Button
                    disabled={unavailable}
                    className="mt-4"
                    onClick={() => setAction({ kind: 'initialize' })}
                  >
                    Iniciar presupuesto
                  </Button>
                )}
            </div>
          ) : (
            <>
              <BudgetAmountsView budget={budget} compact={compact} />
              <p className="text-sm text-teal">
                El presupuesto base corresponde al valor del evento. Las
                ampliaciones aprobadas se suman por separado. El inventario
                conserva su gasto histórico al devolver unidades; cancelar un
                servicio deja de contarlo como gasto. Los importes y el saldo se
                actualizan con las operaciones confirmadas. Un cambio del
                presupuesto base no puede dejar el total asignado por debajo de
                los gastos registrados.
              </p>
              {budget.eventStatus === 'cancelado' ? (
                <p className="rounded-lg bg-amber-50 p-3 text-sm">
                  Evento cancelado: se conserva el historial y no se admiten
                  solicitudes ni decisiones nuevas.
                </p>
              ) : (
                can('presupuestos.editar') && (
                  <div>
                    <Button
                      disabled={unavailable}
                      onClick={() => setAction({ kind: 'request' })}
                    >
                      Solicitar cambio de presupuesto
                    </Button>
                    <p className="mt-2 text-sm text-teal">
                      Un usuario distinto del líder responsable debe enviar la
                      solicitud para su autorización.
                    </p>
                  </div>
                )
              )}
            </>
          )}
          {can('eventos.ver') && (
            <Link
              className="text-sm font-semibold text-teal underline"
              href={`/eventos/${eventId}`}
            >
              Consultar evento y presupuesto base →
            </Link>
          )}
          {compact ? (
            <Link
              className="text-sm font-semibold text-teal underline"
              href={`/presupuestos?eventId=${encodeURIComponent(eventId)}`}
            >
              Ver detalle e historial del presupuesto →
            </Link>
          ) : (
            <>
              <section>
                <h3 className="mb-3 text-lg font-bold">
                  Historial de solicitudes y decisiones
                </h3>
                <p className="mb-4 text-sm text-teal">
                  Las solicitudes pendientes todavía no alteran los totales.
                </p>
                {approvalError && (
                  <ErrorMessage
                    message={`No se pudieron consultar tus autorizaciones: ${approvalError}`}
                  />
                )}
                {!budget.requests.length ? (
                  <p className="text-sm text-teal">
                    No hay solicitudes registradas.
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {budget.requests.map((request) => (
                      <article
                        key={request.id}
                        className="rounded-xl border border-sky-blue p-4"
                      >
                        <div className="flex flex-wrap justify-between gap-2">
                          <h4 className="font-bold">
                            {requestLabels[request.type]} ·{' '}
                            {cop(request.amountCop)}
                          </h4>
                          <span
                            className={`rounded-full px-3 py-1 text-sm ${request.status === 'pendiente' ? 'bg-amber-50 text-amber-900' : 'bg-beige'}`}
                          >
                            {request.status === 'pendiente'
                              ? 'Pendiente · sin efecto en el saldo'
                              : request.status}
                          </span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                          {request.reason}
                        </p>
                        <p className="mt-2 break-all text-xs text-teal">
                          Solicitante: {request.requestedBy}
                          {request.requestedBy === user?.id
                            ? ' (tú)'
                            : ''} ·{' '}
                          {new Date(request.requestedAt).toLocaleString(
                            'es-CO',
                          )}
                        </p>
                        {request.decidedAt && (
                          <p className="mt-2 break-all text-xs text-teal">
                            Decisión: {request.decidedBy} ·{' '}
                            {new Date(request.decidedAt).toLocaleString(
                              'es-CO',
                            )}
                          </p>
                        )}
                        {request.rejectionReason && (
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                            Motivo de rechazo: {request.rejectionReason}
                          </p>
                        )}
                        {canApprove &&
                          budget.eventStatus !== 'cancelado' &&
                          request.status === 'pendiente' &&
                          request.requestedBy !== user?.id &&
                          eligible.includes(request.id) && (
                            <div className="mt-4 flex flex-wrap gap-3">
                              <Button
                                disabled={unavailable || preparing}
                                onClick={() => void decide('approve', request)}
                              >
                                Aprobar
                              </Button>
                              <Button
                                variant="secondary"
                                disabled={unavailable || preparing}
                                onClick={() => void decide('reject', request)}
                              >
                                Rechazar
                              </Button>
                            </div>
                          )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
              <section>
                <h3 className="mb-3 text-lg font-bold">Inventario histórico</h3>
                {!budget.inventoryLines.length ? (
                  <p className="text-sm text-teal">
                    No hay asignaciones registradas.
                  </p>
                ) : (
                  <DataTable
                    rows={budget.inventoryLines}
                    rowKey={(row) => row.id}
                    columns={[
                      {
                        key: 'name',
                        header: 'Recurso',
                        render: (row) => row.name,
                      },
                      {
                        key: 'quantity',
                        header: 'Unidades',
                        render: (row) => row.quantity,
                      },
                      {
                        key: 'cost',
                        header: 'Costo histórico',
                        render: (row) => cop(row.costAmountCop),
                      },
                      {
                        key: 'status',
                        header: 'Estado',
                        render: (row) => row.status,
                      },
                    ]}
                  />
                )}
              </section>
              <section>
                <h3 className="mb-3 text-lg font-bold">
                  Servicios de proveedores
                </h3>
                {!budget.providerLines.length ? (
                  <p className="text-sm text-teal">
                    No hay acuerdos registrados.
                  </p>
                ) : (
                  <DataTable
                    rows={budget.providerLines}
                    rowKey={(row) => row.id}
                    columns={[
                      {
                        key: 'provider',
                        header: 'Proveedor',
                        render: (row) => row.providerName,
                      },
                      {
                        key: 'name',
                        header: 'Servicio',
                        render: (row) => row.serviceName,
                      },
                      {
                        key: 'date',
                        header: 'Fecha acordada',
                        render: (row) => row.startDate,
                      },
                      {
                        key: 'amount',
                        header: 'Valor',
                        render: (row) => cop(row.agreedAmountCop),
                      },
                      {
                        key: 'status',
                        header: 'Estado',
                        render: (row) =>
                          row.status === 'cancelado'
                            ? 'Cancelado · no cuenta como gasto'
                            : 'Confirmado',
                      },
                    ]}
                  />
                )}
              </section>
            </>
          )}
        </div>
      )}
      {action && budget && (
        <BudgetActionDialog
          action={action}
          budget={budget}
          onClose={() => setAction(null)}
          onConflict={refresh}
          onSaved={(message) => {
            setAction(null);
            setNotice(message);
            refresh();
          }}
        />
      )}
    </Card>
  );
}
