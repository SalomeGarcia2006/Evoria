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
import { ErrorMessage } from '../ui/ErrorMessage';
import { LoadingState } from '../ui/LoadingState';
import { FeedbackMessages, useFeedback } from '../ui/Feedback';
import { BudgetAmountsView, cop, requestLabels } from './BudgetAmountsView';
import { BudgetActionDialog, type BudgetAction } from './BudgetActionDialog';
import {
  BudgetHistoryDialog,
  type BudgetHistorySection,
} from './BudgetHistoryDialog';

export function BudgetPanel({
  eventId,
  revision = 0,
  onChanged,
  onLoaded,
  onBusyChange,
}: {
  eventId: string;
  revision?: number;
  onChanged?: () => void;
  onLoaded?: (budget: EventBudgetDetail) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { user, can } = useAuth();
  const allowed = can('presupuestos.ver');
  const canApprove = can('presupuestos.aprobar');
  const [attempt, setAttempt] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);
  const manualRefresh = useRef(false);
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
  const [historyDetail, setHistoryDetail] =
    useState<BudgetHistorySection | null>(null);
  useEffect(() => {
    onBusyChange?.(preparing);
  }, [preparing, onBusyChange]);
  useEffect(() => {
    if (!allowed || !user) return;
    let active = true;
    getEventBudget(eventId)
      .then((data) => {
        if (active) {
          setResult({ owner: user, key, data });
          onLoaded?.(data);
          if (manualRefresh.current) {
            manualRefresh.current = false;
            setHasChanges(false);
            notify('El presupuesto se consultó correctamente.');
          }
        }
      })
      .catch((error: unknown) => {
        if (active) manualRefresh.current = false;
        if (active) notify(apiErrorMessage(error), 'error');
        if (active)
          setResult((previous) => ({
            owner: user,
            key,
            data:
              previous?.owner === user && previous.key.startsWith(`${eventId}:`)
                ? previous.data
                : undefined,
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
  }, [allowed, canApprove, eventId, key, user, notify, onLoaded]);
  const current =
    result?.owner === user && result.key.startsWith(`${eventId}:`)
      ? result
      : undefined;
  const budget = current?.data;
  const loading = current?.key !== key;
  const unavailable = loading || !!current?.error;
  function refresh() {
    feedback.dismiss();
    setAttempt((value) => value + 1);
    onChanged?.();
  }
  function updateBudget() {
    if (current?.error) {
      refresh();
      return;
    }
    if (!hasChanges) {
      feedback.guide(
        'Para actualizar el presupuesto, primero debes iniciarlo, registrar una solicitud o tomar una decisión sobre una solicitud.',
        'Revisa los cambios del presupuesto',
        'error',
      );
      return;
    }
    manualRefresh.current = true;
    refresh();
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
      {loading && !budget && <LoadingState label="Actualizando presupuesto…" />}
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
          <p className="text-sm font-semibold text-muted">
            Presupuesto del evento
          </p>
          <h2 className="mt-1 break-words text-2xl font-bold">
            {budget?.eventName ?? 'Cargando presupuesto'}
          </h2>
          {budget && (
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${['borrador', 'planificado', 'en_progreso'].includes(budget.eventStatus) ? 'bg-teal/10 text-muted' : 'bg-beige text-navy'}`}
              >
                {budget.eventStatus.replaceAll('_', ' ')}
              </span>
              {can('eventos.ver') && (
                <Link
                  className="text-sm font-semibold text-muted underline"
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
          onClick={updateBudget}
        >
          Actualizar presupuesto
        </Button>
      </header>
      {budget &&
        (!budget.initialized ? (
          <Card>
            <h3 className="text-lg font-bold">Falta iniciar el presupuesto</h3>
            <p className="mt-2 text-sm text-muted">
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
                      <p className="text-xs leading-5 text-muted">
                        Ambas solicitudes requieren la aprobación del líder. Una
                        solicitud pendiente todavía no modifica el saldo.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted">
                      Necesitas permiso de edición para enviar solicitudes de
                      cambio.
                    </p>
                  )}
                  <button
                    type="button"
                    className="text-left text-sm font-semibold text-muted underline"
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
                <p className="mt-2 text-sm text-muted">
                  Gastos registrados en el presupuesto del evento.
                </p>
                <div className="mt-5 divide-y divide-sky-blue">
                  {(
                    [
                      [
                        'Inventario asignado',
                        budget.inventorySpentCop,
                        'recursos.svg',
                        'inventory',
                      ],
                      [
                        'Servicios de proveedores confirmados',
                        budget.providerSpentCop,
                        'empresas.svg',
                        'providers',
                      ],
                      [
                        'Costos adicionales aprobados',
                        budget.extraSpentCop,
                        'presupuesto.svg',
                        'extras',
                      ],
                    ] as const
                  ).map(([label, amount, icon, section]) => (
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      onClick={() => setHistoryDetail(section)}
                      className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-4 text-left transition-colors duration-200 hover:bg-sky-blue/30 focus-visible:bg-sky-blue/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                      key={label}
                    >
                      <span className="flex min-w-0 items-center gap-3 text-sm">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-blue/40">
                          <Image
                            alt=""
                            className="brightness-0 opacity-60"
                            src={`/icons/${icon}`}
                            width={22}
                            height={22}
                          />
                        </span>
                        <span className="break-words">{label}</span>
                      </span>
                      <span className="flex items-center gap-2 font-semibold">
                        {cop(amount)}
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="size-5 shrink-0 text-muted transition duration-200 group-hover:translate-x-0.5 group-hover:text-navy group-focus-visible:translate-x-0.5 group-focus-visible:text-navy motion-reduce:transform-none motion-reduce:transition-none"
                        >
                          <path
                            d="m9 5 7 7-7 7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </button>
                  ))}
                  <div className="flex flex-wrap justify-between gap-3 rounded-xl bg-sky-blue/40 p-4">
                    <span className="font-bold">Total gastado</span>
                    <span className="font-bold">{cop(budget.spentCop)}</span>
                  </div>
                </div>
                <p className="mt-4 text-xs leading-5 text-muted">
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
                      <p className="mt-2 text-sm text-muted">
                        Ampliaciones y costos adicionales del evento.
                      </p>
                    </div>
                    <span className="rounded-full bg-beige px-3 py-1 text-xs text-muted">
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
                    <p className="my-5 text-sm text-muted">
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
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${request.status === 'pendiente' ? 'bg-amber-50 text-amber-900' : request.status === 'aprobada' ? 'bg-teal/10 text-muted' : 'bg-beige text-navy'}`}
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
                          <p className="mt-2 text-xs text-muted">
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
                            <div className="mt-3 grid gap-2 text-xs text-muted">
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
                      className="mt-4 text-sm font-semibold text-muted underline"
                      onClick={() => setShowHistory((value) => !value)}
                    >
                      {showHistory
                        ? 'Mostrar solicitudes recientes'
                        : `Mostrar historial y decisiones (${requests.length})`}
                    </button>
                  )}
                  <p className="mt-5 rounded-xl bg-sky-blue/30 p-3 text-xs leading-5 text-muted">
                    Las solicitudes pendientes permanecen separadas. Solo los
                    cambios aprobados se reflejan en los totales del
                    presupuesto.
                  </p>
                </Card>
              </section>
            </div>
          </>
        ))}
      {historyDetail && budget && (
        <BudgetHistoryDialog
          key={`${eventId}:${historyDetail}`}
          section={historyDetail}
          budget={budget}
          onClose={() => setHistoryDetail(null)}
        />
      )}
      {action && budget && (
        <BudgetActionDialog
          action={action}
          budget={budget}
          onClose={() => setAction(null)}
          onConflict={refresh}
          onSaved={(message) => {
            setAction(null);
            setHasChanges(true);
            refresh();
            notify(message);
          }}
        />
      )}
    </div>
  );
}
