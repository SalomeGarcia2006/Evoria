'use client';

import { useEffect, useState } from 'react';
import type { BudgetOverview } from '@evoria/contracts';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { LoadingState } from '../../components/ui/LoadingState';
import { useAuth } from '../../hooks/useAuth';
import { getAllBudgets } from '../../services/presupuestos.service';

const money = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);

export default function PresupuestosPage() {
  const { user, can } = useAuth();
  const allowed = can('presupuestos.ver');
  const [state, setState] = useState<{
    owner: typeof user;
    data?: BudgetOverview;
    error?: string;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const [resourcesCost, setResourcesCost] = useState('');
  const [otherCost, setOtherCost] = useState('');
  useEffect(() => {
    if (!user || !allowed) return;
    let active = true;
    getAllBudgets()
      .then((data) => {
        if (active) setState({ owner: user, data });
      })
      .catch((error: unknown) => {
        if (active)
          setState({
            owner: user,
            error:
              error instanceof Error
                ? error.message
                : 'No se pudieron cargar los presupuestos.',
          });
      });
    return () => {
      active = false;
    };
  }, [user, allowed, revision]);
  const current = state?.owner === user ? state : null;
  const data = current?.data;
  return (
    <AppShell title="Presupuestos">
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">Presupuestos de eventos</h2>
            <p className="mt-2 text-teal">
              Consulta la ejecución financiera de tu empresa.
            </p>
          </div>
          {allowed && (
            <Button
              onClick={() => {
                setState(null);
                setRevision((value) => value + 1);
              }}
            >
              Actualizar
            </Button>
          )}
        </div>
        {!allowed ? (
          <p>No tienes permiso para consultar presupuestos.</p>
        ) : !current ? (
          <LoadingState label="Cargando presupuestos..." />
        ) : current.error ? (
          <ErrorMessage message={current.error} />
        ) : null}
        {allowed && data && (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              {[
                ['Presupuesto asignado', data.totals.allocatedCop],
                ['Ejecutado', data.totals.spentCop],
                ['Disponible', data.totals.remainingCop],
              ].map(([label, value]) => (
                <Card key={label}>
                  <p className="text-sm text-teal">{label}</p>
                  <p className="mt-3 text-2xl font-bold">
                    {money(Number(value))}
                  </p>
                  <p className="mt-2 text-xs text-teal">
                    Eventos no cancelados
                  </p>
                </Card>
              ))}
            </section>
            <Card>
              <h3 className="mb-4 font-bold">Resumen por evento</h3>
              <DataTable
                columns={[
                  {
                    key: 'event',
                    header: 'Evento',
                    render: (row) => row.eventName,
                  },
                  {
                    key: 'allocated',
                    header: 'Asignado',
                    render: (row) =>
                      row.initialized
                        ? money(row.allocatedCop)
                        : 'Sin presupuesto inicial',
                  },
                  {
                    key: 'spent',
                    header: 'Ejecutado',
                    render: (row) =>
                      row.initialized ? money(row.spentCop) : '—',
                  },
                  {
                    key: 'remaining',
                    header: 'Disponible',
                    render: (row) =>
                      row.initialized ? money(row.remainingCop) : '—',
                  },
                  {
                    key: 'status',
                    header: 'Estado',
                    render: (row) => row.eventStatus.replaceAll('_', ' '),
                  },
                ]}
                rows={data.items}
                rowKey={(row) => row.eventId}
              />
              {data.items.length === 0 && (
                <p className="mt-4 text-sm text-teal">
                  No hay eventos registrados.
                </p>
              )}
            </Card>
            <Card>
              <h3 className="font-bold">Calculadora de presupuesto</h3>
              <p className="mt-2 text-sm text-teal">
                Estima costos. Este cálculo no guarda datos.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  Costos de recursos
                  <input
                    className="rounded-lg border border-sky-blue p-3"
                    type="number"
                    min="0"
                    value={resourcesCost}
                    onChange={(event) => setResourcesCost(event.target.value)}
                  />
                </label>
                <label className="grid gap-2">
                  Costos adicionales
                  <input
                    className="rounded-lg border border-sky-blue p-3"
                    type="number"
                    min="0"
                    value={otherCost}
                    onChange={(event) => setOtherCost(event.target.value)}
                  />
                </label>
              </div>
              <p className="mt-4 font-bold">
                Total estimado:{' '}
                {money(
                  Math.max(0, Number(resourcesCost) || 0) +
                    Math.max(0, Number(otherCost) || 0),
                )}
              </p>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
