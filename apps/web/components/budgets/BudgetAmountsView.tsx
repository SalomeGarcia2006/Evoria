'use client';
import type { BudgetAmounts } from '@evoria/contracts';
export const cop = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
export const requestLabels = {
  ampliacion: 'Ampliación',
  costo_adicional: 'Costo adicional',
};
export function BudgetAmountsView({
  budget,
  compact = false,
}: {
  budget: BudgetAmounts;
  compact?: boolean;
}) {
  return (
    <dl
      className={`grid gap-3 ${compact ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3'}`}
    >
      {(
        [
          ['Presupuesto base del evento', budget.baseAmountCop],
          ['Ampliaciones aprobadas', budget.approvedIncreaseCop],
          ['Inventario asignado', budget.inventorySpentCop],
          ['Servicios confirmados', budget.providerSpentCop],
          ['Costos adicionales aprobados', budget.extraSpentCop],
          ['Total asignado', budget.allocatedCop],
          ['Total gastado', budget.spentCop],
          ['Disponible', budget.remainingCop],
        ] as const
      )
        .filter((_, index) => !compact || index >= 5)
        .map(([label, amount]) => (
          <div
            className={`min-w-0 rounded-xl p-4 ${label === 'Disponible' ? 'bg-teal/10' : label === 'Total asignado' ? 'bg-sky-blue/30' : 'bg-beige/70'}`}
            key={label}
          >
            <dt className="text-sm text-teal">{label}</dt>
            <dd className="mt-2 break-words text-xl font-bold">
              {amount === null ? 'Sin iniciar' : cop(amount)}
            </dd>
          </div>
        ))}
    </dl>
  );
}
