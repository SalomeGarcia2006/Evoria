'use client';
import { useEffect, useState } from 'react';
import type { BudgetOverview } from '@evoria/contracts';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import {
  getBudgets,
  getBudgetAuthorizations,
  type BudgetAuthorization,
} from '../../services/presupuestos.service';
import { apiErrorMessage } from '../../services/api';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { DataTable } from '../ui/DataTable';
import { LoadingState } from '../ui/LoadingState';
import { ErrorMessage } from '../ui/ErrorMessage';
import { Field } from '../providers/fields';
import { BudgetPanel } from './BudgetPanel';
import { cop, requestLabels } from './BudgetAmountsView';
import { BudgetEstimator } from './BudgetEstimator';

export function BudgetsWorkspace() {
  const { user } = useAuth();
  return <BudgetsWorkspaceContent key={`${user?.tenant?.id}:${user?.id}`} />;
}
function BudgetsWorkspaceContent() {
  const { user, can } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const eventId = params.get('eventId') ?? '';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [view, setView] = useState<'overview' | 'authorizations'>(
    params.get('view') === 'authorizations' ? 'authorizations' : 'overview',
  );
  const allowed = can('presupuestos.ver');
  const approve = can('presupuestos.aprobar');
  const [result, setResult] = useState<{
    key: string;
    data?: BudgetOverview;
    error?: string;
  }>();
  const [inbox, setInbox] = useState<{
    revision: number;
    items?: BudgetAuthorization[];
    error?: string;
  }>();
  const key = JSON.stringify([search, page, revision]);
  useEffect(() => {
    if (!user || !allowed) return;
    let active = true;
    const timer = setTimeout(() => {
      getBudgets(page, search)
        .then((data) => {
          if (active) setResult({ key, data });
        })
        .catch((error: unknown) => {
          if (active) setResult({ key, error: apiErrorMessage(error) });
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [user, allowed, page, search, key]);
  useEffect(() => {
    if (!user || !approve) return;
    let active = true;
    getBudgetAuthorizations()
      .then((items) => {
        if (active) setInbox({ revision, items });
      })
      .catch((error: unknown) => {
        if (active) setInbox({ revision, error: apiErrorMessage(error) });
      });
    return () => {
      active = false;
    };
  }, [user, approve, revision]);
  const data = result?.key === key ? result.data : undefined;
  const error = result?.key === key ? result.error : undefined;
  const pending = inbox?.revision === revision ? inbox : undefined;
  function refresh() {
    setRevision((value) => value + 1);
  }
  function open(id: string) {
    router.push(`/presupuestos?eventId=${encodeURIComponent(id)}`, {
      scroll: false,
    });
  }
  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Presupuestos de eventos</h1>
          <p className="mt-2 text-teal">
            Consulta gastos y saldo, solicita cambios y revisa las decisiones.
          </p>
        </div>
        <Button variant="secondary" onClick={refresh}>
          Actualizar
        </Button>
      </div>
      <nav
        aria-label="Secciones de presupuestos"
        className="flex flex-wrap gap-3"
      >
        <Button
          variant={view === 'overview' ? 'primary' : 'secondary'}
          onClick={() => setView('overview')}
        >
          Resumen por evento
        </Button>
        {approve && (
          <Button
            variant={view === 'authorizations' ? 'primary' : 'secondary'}
            onClick={() => setView('authorizations')}
          >
            Autorizaciones pendientes
            {pending?.items ? ` (${pending.items.length})` : ''}
          </Button>
        )}
      </nav>
      {view === 'overview' && (
        <>
          {!allowed ? (
            <p>No tienes permiso para consultar presupuestos.</p>
          ) : (
            <>
              {data && (
                <section
                  aria-label="Totales de presupuestos"
                  className="grid gap-4 sm:grid-cols-3"
                >
                  {[
                    ['Presupuesto asignado', data.totals.allocatedCop],
                    ['Total gastado', data.totals.spentCop],
                    ['Disponible', data.totals.remainingCop],
                  ].map(([label, value]) => (
                    <Card key={label}>
                      <p className="text-sm text-teal">{label}</p>
                      <p className="mt-3 text-2xl font-bold">
                        {cop(Number(value))}
                      </p>
                      <p className="mt-2 text-xs text-teal">
                        Todos los eventos no cancelados de la empresa
                      </p>
                    </Card>
                  ))}
                </section>
              )}
              <Card className="min-w-0">
                <div className="mb-5 max-w-lg">
                  <Field
                    label="Buscar evento"
                    value={search}
                    maxLength={120}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                {error ? (
                  <ErrorMessage message={error} />
                ) : !data ? (
                  <LoadingState label="Cargando presupuestos…" />
                ) : (
                  <>
                    {!data.items.length ? (
                      <p className="py-5 text-teal">
                        No hay eventos que coincidan con la búsqueda.
                      </p>
                    ) : (
                      <DataTable
                        rows={data.items}
                        rowKey={(row) => row.eventId}
                        columns={[
                          {
                            key: 'event',
                            header: 'Evento',
                            render: (row) => (
                              <button
                                className="text-left font-semibold text-teal underline"
                                onClick={() => open(row.eventId)}
                              >
                                {row.eventName}
                              </button>
                            ),
                          },
                          {
                            key: 'base',
                            header: 'Presupuesto base',
                            render: (row) =>
                              row.baseAmountCop === null
                                ? 'Sin iniciar'
                                : cop(row.baseAmountCop),
                          },
                          {
                            key: 'allocated',
                            header: 'Asignado',
                            render: (row) =>
                              row.initialized
                                ? cop(row.allocatedCop)
                                : 'Sin presupuesto inicial',
                          },
                          {
                            key: 'spent',
                            header: 'Gastado',
                            render: (row) =>
                              row.initialized ? cop(row.spentCop) : '—',
                          },
                          {
                            key: 'remaining',
                            header: 'Disponible',
                            render: (row) =>
                              row.initialized ? cop(row.remainingCop) : '—',
                          },
                          {
                            key: 'status',
                            header: 'Estado',
                            render: (row) =>
                              row.eventStatus.replaceAll('_', ' '),
                          },
                        ]}
                      />
                    )}
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm">
                        {data.pagination.total} eventos · Página {page} de{' '}
                        {Math.max(1, data.pagination.totalPages)}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          disabled={page <= 1}
                          onClick={() => setPage(page - 1)}
                        >
                          Anterior
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={page >= data.pagination.totalPages}
                          onClick={() => setPage(page + 1)}
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            </>
          )}
        </>
      )}
      {view === 'authorizations' && approve && (
        <Card>
          <h2 className="text-xl font-bold">Autorizaciones pendientes</h2>
          <p className="my-3 text-sm text-teal">
            Solicitudes de los eventos que lideras, enviadas por otra persona.
            Abre el presupuesto para revisar el saldo actual antes de decidir.
          </p>
          {!allowed && (
            <p className="my-3 text-sm text-amber-900">
              Necesitas presupuestos.ver para consultar el resumen financiero
              antes de decidir.
            </p>
          )}
          {pending?.error ? (
            <ErrorMessage message={pending.error} />
          ) : !pending?.items ? (
            <LoadingState label="Cargando autorizaciones…" />
          ) : !pending.items.length ? (
            <p className="py-4 text-teal">
              No tienes autorizaciones pendientes.
            </p>
          ) : (
            <div className="grid gap-3">
              {pending.items.map((request) => (
                <article
                  className="rounded-xl border border-sky-blue p-4"
                  key={request.id}
                >
                  <h3 className="font-semibold">{request.eventName}</h3>
                  <p className="mt-2">
                    {requestLabels[request.type]} · {cop(request.amountCop)}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-teal">
                    {request.reason}
                  </p>
                  <p className="mt-2 text-xs text-amber-900">
                    Pendiente · todavía no altera el saldo
                  </p>
                  <Button
                    className="mt-4"
                    disabled={!allowed}
                    onClick={() => open(request.eventId)}
                  >
                    Revisar presupuesto y decidir
                  </Button>
                </article>
              ))}
            </div>
          )}
        </Card>
      )}
      {eventId && allowed && (
        <section aria-label="Detalle del presupuesto" className="grid gap-4">
          <div>
            <Button
              variant="secondary"
              onClick={() => router.push('/presupuestos', { scroll: false })}
            >
              Cerrar detalle
            </Button>
          </div>
          <BudgetPanel
            key={eventId}
            eventId={eventId}
            revision={revision}
            onChanged={refresh}
          />
        </section>
      )}
      {view === 'overview' && allowed && <BudgetEstimator />}
    </div>
  );
}
