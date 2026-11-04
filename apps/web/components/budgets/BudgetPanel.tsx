'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
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
import { FeedbackMessages, useFeedback } from '../ui/Feedback';
import { BudgetAmountsView, cop, requestLabels } from './BudgetAmountsView';
import { BudgetActionDialog, type BudgetAction } from './BudgetActionDialog';

export function BudgetPanel({
  eventId,
  revision = 0,
  onChanged,
}: {
  eventId: string;
  revision?: number;
  onChanged?: () => void;
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
  const feedback = useFeedback();
  const { notify } = feedback;
  const [preparing, setPreparing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const history = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!allowed || !user) return;
    let active = true;
    getEventBudget(eventId)
      .then((data) => {
        if (active) {
          setResult({ owner: user, key, data });
        }
      })
      .catch((error: unknown) => {
        if (active) notify(apiErrorMessage(error), 'error');
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
  }, [allowed, canApprove, eventId, key, user, notify]);
  const current = result?.owner === user ? result : undefined;
  const budget = current?.data;
  const loading = current?.key !== key;
  const unavailable = loading || !!current?.error;
  function refresh() {
    feedback.dismiss();
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
        feedback.guide(
          'La solicitud ya fue decidida o el evento está cancelado. Consulta el historial actualizado.',
        );
        refresh();
        return;
      }
      setAction({ kind, request: pending });
    } catch (error) {
      notify(apiErrorMessage(error), 'error');
    } finally {
      setPreparing(false);
    }
  }
  const requests = [...(budget?.requests ?? [])].reverse();
  const visibleRequests = showHistory ? requests : requests.slice(0, 3);
  const utilization =
    budget && budget.allocatedCop > 0
      ? Math.round((budget.spentCop / budget.allocatedCop) * 100)
      : 0;
  function openHistory() {
    setShowHistory(true);
    history.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (!allowed) return null;
  return (
    <div className="grid min-w-0 gap-5">
      <FeedbackMessages feedback={feedback} />
      {loading && <LoadingState label="Actualizando presupuesto…" />}
      {current?.error && (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
          {current.error}
        </p>
      )}
      {current?.error && budget && (
        <p className="text-sm text-amber-900">
          Se muestran los últimos datos consultados. Actualiza el presupuesto
          para habilitar nuevas operaciones.
        </p>
      )}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-teal">
            Presupuesto del evento
          </p>
          <h2 className="mt-1 break-words text-2xl font-bold">
            {budget?.eventName ?? 'Cargando presupuesto'}
          </h2>
          {budget && (
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${['borrador', 'planificado', 'en_progreso'].includes(budget.eventStatus) ? 'bg-teal/10 text-teal' : 'bg-beige text-navy'}`}
              >
                {budget.eventStatus.replaceAll('_', ' ')}
              </span>
              {can('eventos.ver') && (
                <Link
                  className="text-sm font-semibold text-teal underline"
                  href={`/eventos/${encodeURIComponent(eventId)}`}
                >
                  Ver evento ↗
                </Link>
              )}
            </div>
          )}
        </div>
        <Button
          variant="secondary"
          disabled={loading || preparing}
          onClick={refresh}
        >
          Actualizar presupuesto
        </Button>
      </header>
      {budget &&
        (!budget.initialized ? (
          <Card>
            <h3 className="text-lg font-bold">Falta iniciar el presupuesto</h3>
            <p className="mt-2 text-sm text-teal">
              Registra el presupuesto base del evento para empezar. Hasta
              entonces no se pueden asignar nuevas unidades de inventario ni
              servicios de proveedores.
            </p>
            {can('presupuestos.editar') &&
              budget.eventStatus !== 'cancelado' && (
                <Button
                  className="mt-4"
                  disabled={unavailable}
                  onClick={() => setAction({ kind: 'initialize' })}
                >
                  Iniciar presupuesto
                </Button>
              )}
            {budget.eventStatus === 'cancelado' && (
              <p className="mt-3 text-sm text-amber-900">
                El evento está cancelado y conserva su historial.
              </p>
            )}
          </Card>
        ) : (
          <>
            <Card className="min-w-0">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_17rem]">
                <div className="min-w-0">
                  <BudgetAmountsView budget={budget} compact />
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <p className="text-sm font-bold">
                      {utilization} % utilizado
                    </p>
                    <div
                      role="progressbar"
                      aria-label="Porcentaje del presupuesto utilizado"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.min(100, Math.max(0, utilization))}
                      aria-valuetext={`${utilization} % utilizado`}
                      className="h-2.5 min-w-24 flex-1 overflow-hidden rounded-full bg-sky-blue/60"
                    >
                      <div
                        className="h-full rounded-full bg-teal"
                        style={{
                          width: `${Math.min(100, Math.max(0, utilization))}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sky-blue/25 p-4 text-sm">
                    <span>
                      Base <strong>{cop(budget.baseAmountCop ?? 0)}</strong>
                    </span>
                    <span aria-hidden="true">+</span>
                    <span>
                      Ampliaciones aprobadas{' '}
                      <strong>{cop(budget.approvedIncreaseCop)}</strong>
                    </span>
                    <span aria-hidden="true">=</span>
                    <span className="font-semibold">
                      Asignado {cop(budget.allocatedCop)}
                    </span>
                  </div>
                </div>
                <aside
                  aria-label="Operaciones del presupuesto"
                  className="grid content-start gap-3 border-t border-sky-blue pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0"
                >
                  <h3 className="font-bold">Solicitar un cambio</h3>
                  {budget.eventStatus === 'cancelado' ? (
                    <p className="rounded-lg bg-amber-50 p-3 text-sm">
                      Evento cancelado: se conserva el historial y no se admiten
                      solicitudes ni decisiones nuevas.
                    </p>
                  ) : can('presupuestos.editar') ? (
                    <>
                      <Button
                        disabled={unavailable}
                        onClick={() =>
                          setAction({ kind: 'request', type: 'ampliacion' })
                        }
                      >
                        Añadir presupuesto
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={unavailable}
                        onClick={() =>
                          setAction({
                            kind: 'request',
                            type: 'costo_adicional',
                          })
                        }
                      >
                        Registrar costo adicional
                      </Button>
                      <p className="text-xs leading-5 text-teal">
                        Ambas solicitudes requieren la aprobación del líder. Una
                        solicitud pendiente todavía no modifica el saldo.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-teal">
                      Necesitas permiso de edición para enviar solicitudes de
                      cambio.
                    </p>
                  )}
                  <button
                    type="button"
                    className="text-left text-sm font-semibold text-teal underline"
                    onClick={openHistory}
                  >
                    Ver historial completo →
                  </button>
                </aside>
              </div>
            </Card>
            <div className="grid min-w-0 gap-5 xl:grid-cols-2">
              <Card className="min-w-0">
                <h3 className="text-xl font-bold">¿En qué se ha usado?</h3>
                <p className="mt-2 text-sm text-teal">
                  Gastos registrados en el presupuesto del evento.
                </p>
                <dl className="mt-5 divide-y divide-sky-blue">
                  {(
                    [
                      [
                        'Inventario asignado',
                        budget.inventorySpentCop,
                        'recursos.svg',
                      ],
                      [
                        'Servicios de proveedores confirmados',
                        budget.providerSpentCop,
                        'empresas.svg',
                      ],
                      [
                        'Costos adicionales aprobados',
                        budget.extraSpentCop,
                        'presupuesto.svg',
                      ],
                    ] as const
                  ).map(([label, amount, icon]) => (
                    <div
                      className="flex flex-wrap items-center justify-between gap-3 py-4"
                      key={label}
                    >
                      <dt className="flex min-w-0 items-center gap-3 text-sm">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-blue/40">
                          <Image
                            alt=""
                            className="brightness-0 opacity-60"
                            src={`/icons/${icon}`}
                            width={22}
                            height={22}
                          />
                        </span>
                        <span>{label}</span>
                      </dt>
                      <dd className="font-semibold">{cop(amount)}</dd>
                    </div>
                  ))}
                  <div className="flex flex-wrap justify-between gap-3 rounded-xl bg-sky-blue/40 p-4">
                    <dt className="font-bold">Total gastado</dt>
                    <dd className="font-bold">{cop(budget.spentCop)}</dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs leading-5 text-teal">
                  Al devolver inventario, sus unidades vuelven a estar
                  disponibles y su costo se libera del presupuesto del evento.
                  Los servicios cancelados permanecen en el historial y dejan de
                  contar como gasto confirmado.
                </p>
              </Card>
              <section
                ref={history}
                className="min-w-0 scroll-mt-6"
                aria-label="Solicitudes y decisiones"
              >
                <Card className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-bold">
                        Solicitudes y decisiones
                      </h3>
                      <p className="mt-2 text-sm text-teal">
                        Ampliaciones y costos adicionales del evento.
                      </p>
                    </div>
                    <span className="rounded-full bg-beige px-3 py-1 text-xs text-teal">
                      {budget.requests.length} solicitudes
                    </span>
                  </div>
                  {approvalError && (
                    <div className="mt-4">
                      <ErrorMessage
                        message={`No se pudieron consultar tus autorizaciones: ${approvalError}`}
                      />
                    </div>
                  )}
                  {!requests.length ? (
                    <p className="my-5 text-sm text-teal">
                      No hay solicitudes registradas.
                    </p>
                  ) : (
                    <div className="mt-5 grid gap-3">
                      {visibleRequests.map((request) => (
                        <article
                          key={request.id}
                          className="rounded-xl border border-sky-blue p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <h4 className="font-bold">
                              {requestLabels[request.type]} ·{' '}
                              {cop(request.amountCop)}
                            </h4>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${request.status === 'pendiente' ? 'bg-amber-50 text-amber-900' : request.status === 'aprobada' ? 'bg-teal/10 text-teal' : 'bg-beige text-navy'}`}
                            >
                              {request.status === 'pendiente'
                                ? 'Pendiente · sin efecto en el saldo'
                                : request.status === 'aprobada'
                                  ? 'Aprobada'
                                  : 'Rechazada'}
                            </span>
                          </div>
                          <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                            {request.reason}
                          </p>
                          <p className="mt-2 text-xs text-teal">
                            {new Date(request.requestedAt).toLocaleString(
                              'es-CO',
                            )}
                          </p>
                          {request.rejectionReason && (
                            <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                              Motivo de rechazo: {request.rejectionReason}
                            </p>
                          )}
                          {showHistory && (
                            <div className="mt-3 grid gap-2 text-xs text-teal">
                              <p className="break-all">
                                Solicitante: {request.requestedBy}
                                {request.requestedBy === user?.id
                                  ? ' (tú)'
                                  : ''}
                              </p>
                              {request.decidedAt && (
                                <p className="break-all">
                                  Decisión: {request.decidedBy} ·{' '}
                                  {new Date(request.decidedAt).toLocaleString(
                                    'es-CO',
                                  )}
                                </p>
                              )}
                            </div>
                          )}
                          {canApprove &&
                            budget.eventStatus !== 'cancelado' &&
                            request.status === 'pendiente' &&
                            request.requestedBy !== user?.id &&
                            eligible.includes(request.id) && (
                              <div className="mt-4 flex flex-wrap gap-3">
                                <Button
                                  disabled={unavailable || preparing}
                                  onClick={() =>
                                    void decide('approve', request)
                                  }
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
                  {requests.length > 0 && (
                    <button
                      type="button"
                      className="mt-4 text-sm font-semibold text-teal underline"
                      onClick={() => setShowHistory((value) => !value)}
                    >
                      {showHistory
                        ? 'Mostrar solicitudes recientes'
                        : `Mostrar historial y decisiones (${requests.length})`}
                    </button>
                  )}
                  <p className="mt-5 rounded-xl bg-sky-blue/30 p-3 text-xs leading-5 text-teal">
                    Las solicitudes pendientes permanecen separadas. Solo los
                    cambios aprobados se reflejan en los totales del
                    presupuesto.
                  </p>
                </Card>
              </section>
            </div>
            <div className="grid min-w-0 gap-5 xl:grid-cols-2">
              <Card className="min-w-0">
                <details>
                  <summary className="cursor-pointer font-bold">
                    Detalle de inventario histórico
                  </summary>
                  <div className="mt-4">
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
                  </div>
                </details>
              </Card>
              <Card className="min-w-0">
                <details>
                  <summary className="cursor-pointer font-bold">
                    Detalle de servicios de proveedores
                  </summary>
                  <div className="mt-4">
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
                  </div>
                </details>
              </Card>
            </div>
          </>
        ))}
      {action && budget && (
        <BudgetActionDialog
          action={action}
          budget={budget}
          onClose={() => setAction(null)}
          onConflict={refresh}
          onSaved={(message) => {
            setAction(null);
            refresh();
            notify(message);
          }}
        />
      )}
    </div>
  );
}
