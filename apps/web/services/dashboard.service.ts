import { getAllEvents } from './events.service';
import { getAllBudgets } from './presupuestos.service';
import { getAllResources } from './recursos.service';

async function getInventorySummary() {
  const { items } = await getAllResources();
  return items.reduce(
    (summary, item) => ({
      available:
        summary.available +
        (item.status === 'disponible' ? item.availableQuantity : 0),
      total: summary.total + item.totalQuantity,
      reserved: summary.reserved + item.reservedQuantity,
      resources: summary.resources + 1,
      maintenance:
        summary.maintenance + (item.status === 'mantenimiento' ? 1 : 0),
    }),
    { available: 0, total: 0, reserved: 0, resources: 0, maintenance: 0 },
  );
}

export async function getDashboard(can: (permission: string) => boolean) {
  const results = await Promise.allSettled([
    can('eventos.ver') ? getAllEvents() : Promise.resolve(null),
    can('inventario.ver') ? getInventorySummary() : Promise.resolve(null),
    can('presupuestos.ver') ? getAllBudgets() : Promise.resolve(null),
  ]);
  return {
    events: results[0].status === 'fulfilled' ? results[0].value : null,
    inventory: results[1].status === 'fulfilled' ? results[1].value : null,
    budgets: results[2].status === 'fulfilled' ? results[2].value : null,
    errors: results.flatMap((result, index) =>
      result.status === 'rejected'
        ? [
            `${['Eventos', 'Inventario', 'Presupuestos'][index]}: ${result.reason instanceof Error ? result.reason.message : 'No se pudieron cargar los datos.'}`,
          ]
        : [],
    ),
  };
}
