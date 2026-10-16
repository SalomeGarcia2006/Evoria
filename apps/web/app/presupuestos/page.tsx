'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import type { Presupuesto } from '../../types/presupuesto';

type BudgetRow = Presupuesto & {
  eventName: string;
  spent: number;
  status: string;
};
const initialBudgets: BudgetRow[] = [
  {
    id: 'p-01',
    eventId: 'e-01',
    eventName: 'Encuentro de innovación',
    total: 4200000,
    spent: 3280000,
    currency: 'COP',
    status: 'En curso',
  },
  {
    id: 'p-02',
    eventId: 'e-02',
    eventName: 'Feria de emprendimiento',
    total: 3800000,
    spent: 2490000,
    currency: 'COP',
    status: 'En curso',
  },
  {
    id: 'p-03',
    eventId: 'e-03',
    eventName: 'Jornada de bienestar',
    total: 2500000,
    spent: 1150000,
    currency: 'COP',
    status: 'Borrador',
  },
];
const formatMoney = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);

export default function PresupuestosPage() {
  const [budgets] = useState(initialBudgets);
  const [resourcesCost, setResourcesCost] = useState('');
  const [otherCost, setOtherCost] = useState('');
  const [calculated, setCalculated] = useState(false);
  const subtotal = Number(resourcesCost) || 0;
  const extras = Number(otherCost) || 0;
  const totals = useMemo(
    () =>
      budgets.reduce(
        (result, budget) => ({
          allocated: result.allocated + (budget.total ?? 0),
          spent: result.spent + budget.spent,
        }),
        { allocated: 0, spent: 0 },
      ),
    [budgets],
  );

  return (
    <AppShell title="Presupuestos">
      <div className="grid gap-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.16em] text-teal">
              Planeación financiera
            </p>
            <h2 className="mt-2 text-3xl font-bold">Presupuestos de eventos</h2>
            <p className="mt-1 text-teal">
              Organiza costos y consulta la ejecución de cada evento.
            </p>
          </div>
          <span className="w-fit rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
            Demostración · datos locales
          </span>
        </div>
        <section className="grid gap-4 sm:grid-cols-3">
          {[
            [
              'Presupuesto asignado',
              formatMoney(totals.allocated),
              'En eventos de ejemplo',
            ],
            [
              'Ejecutado',
              formatMoney(totals.spent),
              `${Math.round((totals.spent / totals.allocated) * 100)}% del presupuesto`,
            ],
            [
              'Disponible',
              formatMoney(totals.allocated - totals.spent),
              'Saldo estimado',
            ],
          ].map(([label, value, hint]) => (
            <Card key={label}>
              <p className="text-sm text-teal">{label}</p>
              <p className="mt-3 text-2xl font-bold">{value}</p>
              <p className="mt-1 text-xs text-teal">{hint}</p>
            </Card>
          ))}
        </section>
        <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
          <Card className="p-0">
            <div className="border-b border-sky-blue px-6 py-5">
              <h3 className="font-bold">Resumen por evento</h3>
              <p className="mt-1 text-sm text-teal">
                Presupuesto asignado y ejecución estimada
              </p>
            </div>
            <DataTable
              columns={[
                {
                  key: 'event',
                  header: 'Evento',
                  render: (budget) => (
                    <span className="font-semibold">{budget.eventName}</span>
                  ),
                },
                {
                  key: 'total',
                  header: 'Asignado',
                  render: (budget) => formatMoney(budget.total ?? 0),
                },
                {
                  key: 'spent',
                  header: 'Ejecutado',
                  render: (budget) => formatMoney(budget.spent),
                },
                {
                  key: 'status',
                  header: 'Estado',
                  render: (budget) => <StatusBadge status={budget.status} />,
                },
              ]}
              rowKey={(budget) => budget.id}
              rows={budgets}
            />
            <p className="border-t border-sky-blue px-6 py-3 text-xs text-teal">
              Datos de ejemplo. La API de presupuestos aún no está implementada.
            </p>
          </Card>
          <Card>
            <div>
              <h3 className="text-lg font-bold">Calculadora de presupuesto</h3>
              <p className="mt-1 text-sm text-teal">
                Estima costos antes de asignar un presupuesto.
              </p>
            </div>
            <form
              className="mt-5 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                setCalculated(true);
              }}
            >
              <label className="grid gap-2 text-sm font-semibold">
                Costos de recursos
                <input
                  className="rounded-lg border border-sky-blue px-3 py-2 font-normal"
                  min="0"
                  onChange={(event) => setResourcesCost(event.target.value)}
                  placeholder="0"
                  type="number"
                  value={resourcesCost}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Costos adicionales
                <input
                  className="rounded-lg border border-sky-blue px-3 py-2 font-normal"
                  min="0"
                  onChange={(event) => setOtherCost(event.target.value)}
                  placeholder="0"
                  type="number"
                  value={otherCost}
                />
              </label>
              <div className="rounded-xl bg-beige p-4">
                <div className="flex justify-between text-sm text-teal">
                  <span>Subtotal de recursos</span>
                  <span>{formatMoney(subtotal)}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm text-teal">
                  <span>Costos adicionales</span>
                  <span>{formatMoney(extras)}</span>
                </div>
                <div className="mt-3 flex justify-between border-t border-sky-blue pt-3 font-bold">
                  <span>Total estimado</span>
                  <span>{formatMoney(subtotal + extras)}</span>
                </div>
              </div>
              <Button type="submit">
                {calculated ? 'Cálculo actualizado' : 'Calcular total'}
              </Button>
              <p className="text-xs text-teal">
                El cálculo ocurre en tu navegador y no guarda datos.
              </p>
            </form>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
