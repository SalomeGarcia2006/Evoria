import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';

type InventoryRow = {
  id: string;
  resource: string;
  stock: number;
  available: number;
  cost: string;
  action: string;
};

const inventoryRows: InventoryRow[] = [
  {
    id: 'mat-001',
    resource: 'Sillas - MAT-001',
    stock: 150,
    available: 100,
    cost: '$ 8.000',
    action: 'Editar',
  },
  {
    id: 'mat-002',
    resource: 'Equipo de sonido - MAT-002',
    stock: 3,
    available: 1,
    cost: '$ 600.000',
    action: 'Editar',
  },
  {
    id: 'mat-003',
    resource: 'Proyector - MAT-003',
    stock: 5,
    available: 4,
    cost: '$ 150.000',
    action: 'Editar',
  },
  {
    id: 'rh-001',
    resource: 'Técnico - RH-001',
    stock: 1,
    available: 0,
    cost: '$ 400.000',
    action: 'Ver horario',
  },
];

export default function InventarioPage() {
  return (
    <AppShell title="Inventario">
      <div className="grid gap-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.16em] text-teal">
              Control operativo
            </p>
            <h2 className="mt-2 text-3xl font-bold">Inventario de recursos</h2>
            <p className="mt-1 text-teal">
              Consulta y actualiza recursos y existencias. · RF-09
            </p>
          </div>
          <span className="w-fit rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
            Demostración · datos locales
          </span>
        </div>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            ['Recursos registrados', '4', 'En el inventario de ejemplo'],
            ['Unidades disponibles', '105', 'Existencias listas para asignar'],
            ['Por revisar', '1', 'Recurso sin disponibilidad'],
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
            <div className="flex flex-col gap-4 border-b border-sky-blue px-6 py-5 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="font-bold">Control de inventario</h3>
                <p className="mt-1 text-sm text-teal">
                  Existencias, disponibilidad y costo por recurso
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="sr-only" htmlFor="inventory-search">
                  Buscar recurso
                </label>
                <input
                  className="min-w-48 rounded-lg border border-sky-blue px-3 py-2 text-sm"
                  id="inventory-search"
                  placeholder="Nombre o código"
                  type="text"
                />
                <label className="sr-only" htmlFor="inventory-category">
                  Categoría
                </label>
                <select
                  className="rounded-lg border border-sky-blue bg-white px-3 py-2 text-sm"
                  defaultValue="Todas"
                  id="inventory-category"
                >
                  <option>Todas</option>
                </select>
              </div>
            </div>
            <DataTable
              columns={[
                {
                  key: 'resource',
                  header: 'Recurso',
                  render: (row) => (
                    <span className="font-semibold">{row.resource}</span>
                  ),
                },
                {
                  key: 'stock',
                  header: 'Existencias',
                  render: (row) => (
                    <span className="block text-right">{row.stock}</span>
                  ),
                },
                {
                  key: 'available',
                  header: 'Disponibles',
                  render: (row) => (
                    <span className="block text-right font-semibold">
                      {row.available}
                    </span>
                  ),
                },
                {
                  key: 'cost',
                  header: 'Costo / acción',
                  render: (row) => (
                    <span className="flex items-center justify-end gap-3 whitespace-nowrap">
                      <span className="text-teal">{row.cost}</span>
                      <button
                        className="font-semibold text-teal hover:text-navy hover:underline"
                        type="button"
                      >
                        {row.action}
                      </button>
                    </span>
                  ),
                },
              ]}
              rowKey={(row) => row.id}
              rows={inventoryRows}
            />
            <p className="border-t border-sky-blue px-6 py-3 text-xs text-teal">
              Datos de ejemplo. La API de inventario aún no está implementada.
            </p>
          </Card>

          <Card>
            <h3 className="text-lg font-bold">Edición de recurso</h3>
            <p className="mt-1 text-sm text-teal">
              Consulta los campos disponibles antes de actualizar un recurso.
            </p>
            <div className="mt-5 rounded-xl bg-beige p-4">
              <div className="flex justify-between text-sm text-teal">
                <span>Nombre y categoría</span>
                <span>Listos</span>
              </div>
              <div className="mt-2 flex justify-between text-sm text-teal">
                <span>Cantidad y costo</span>
                <span>Listos</span>
              </div>
              <div className="mt-3 flex justify-between border-t border-sky-blue pt-3 font-bold">
                <span>Estado</span>
                <span>Por confirmar</span>
              </div>
            </div>
            <button
              className="mt-5 w-full rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              type="button"
            >
              Agregar recurso
            </button>
            <p className="mt-3 text-xs text-teal">
              La edición es visual y no guarda datos todavía.
            </p>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
