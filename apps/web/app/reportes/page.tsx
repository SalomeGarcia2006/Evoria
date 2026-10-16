import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';

const reportIdeas = [
  {
    number: '01',
    title: 'Resumen de eventos',
    description: 'Consulta general de actividad y estado de los eventos.',
  },
  {
    number: '02',
    title: 'Uso de recursos',
    description: 'Visualiza disponibilidad y asignación de recursos.',
  },
  {
    number: '03',
    title: 'Ejecución presupuestal',
    description: 'Revisa costos y presupuesto asociados a los eventos.',
  },
];

export default function ReportesPage() {
  return (
    <AppShell title="Reportes">
      <div className="grid gap-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[.16em] text-teal">
            Información
          </p>
          <h2 className="mt-2 text-3xl font-bold">Reportes</h2>
          <p className="mt-1 text-teal">
            Una vista organizada para consultar la información de EVORIA.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {reportIdeas.map((report) => (
            <Card className="flex min-h-48 flex-col" key={report.number}>
              <span className="grid size-10 place-items-center rounded-xl bg-sky-blue/40 text-sm font-bold text-teal">
                {report.number}
              </span>
              <h3 className="mt-5 font-bold">{report.title}</h3>
              <p className="mt-2 text-sm leading-6 text-teal">
                {report.description}
              </p>
            </Card>
          ))}
        </div>
        <Card className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-beige text-xl text-teal"
          >
            ↗
          </span>
          <div>
            <h3 className="font-bold">Exportaciones y filtros pendientes</h3>
            <p className="mt-1 text-sm leading-6 text-teal">
              Los tipos de reporte, filtros y formatos de descarga se definirán
              cuando backend confirme los datos disponibles.
            </p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 sm:ml-auto">
            En preparación
          </span>
        </Card>
      </div>
    </AppShell>
  );
}
