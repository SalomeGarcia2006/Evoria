import Link from 'next/link';
import { AppShell } from '../../../components/layout/AppShell';
import { Card } from '../../../components/ui/Card';
import { StatusBadge } from '../../../components/ui/StatusBadge';

const samples = [
  {
    id: 'r-01',
    name: 'Sillas plegables',
    category: 'Mobiliario',
    available: 120,
    total: 160,
    cost: '$18.000',
    description: 'Sillas plegables para auditorios y espacios exteriores.',
  },
  {
    id: 'r-02',
    name: 'Proyector audiovisual',
    category: 'Tecnología',
    available: 8,
    total: 10,
    cost: '$2.400.000',
    description: 'Proyector portátil para presentaciones y conferencias.',
  },
  {
    id: 'r-03',
    name: 'Carpas 3 × 3 m',
    category: 'Mobiliario',
    available: 2,
    total: 12,
    cost: '$850.000',
    description: 'Carpas plegables para actividades al aire libre.',
  },
  {
    id: 'r-04',
    name: 'Micrófonos inalámbricos',
    category: 'Tecnología',
    available: 14,
    total: 16,
    cost: '$320.000',
    description: 'Micrófonos inalámbricos para escenarios y salas.',
  },
  {
    id: 'r-05',
    name: 'Mesas rectangulares',
    category: 'Mobiliario',
    available: 0,
    total: 18,
    cost: '$95.000',
    description: 'Mesas plegables rectangulares.',
  },
];

export default async function RecursoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const resource = samples.find((item) => item.id === id);
  return (
    <AppShell title="Detalle del recurso">
      <div className="mx-auto grid max-w-3xl gap-6">
        <Link
          className="text-sm font-semibold text-teal hover:underline"
          href="/recursos"
        >
          ← Volver al catálogo
        </Link>
        {resource ? (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[.16em] text-teal">
                  {resource.category}
                </p>
                <h2 className="mt-2 text-3xl font-bold">{resource.name}</h2>
              </div>
              <StatusBadge
                status={resource.available ? 'Disponible' : 'Agotado'}
              />
            </div>
            <p className="mt-5 text-teal">{resource.description}</p>
            <div className="mt-7 grid gap-4 border-t border-sky-blue pt-6 sm:grid-cols-3">
              {[
                ['Disponibles', `${resource.available} unidades`],
                ['Cantidad total', `${resource.total} unidades`],
                ['Costo unitario', resource.cost],
              ].map(([label, value]) => (
                <div className="rounded-xl bg-beige p-4" key={label}>
                  <p className="text-sm text-teal">{label}</p>
                  <p className="mt-2 font-bold">{value}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs text-teal">
              Información de ejemplo. El detalle se conectará cuando exista el
              endpoint de recursos.
            </p>
          </Card>
        ) : (
          <Card>
            <h2 className="text-xl font-bold">Recurso no encontrado</h2>
            <p className="mt-2 text-teal">
              No hay un recurso de demostración con este identificador.
            </p>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
