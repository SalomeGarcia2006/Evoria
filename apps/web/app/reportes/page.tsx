'use client';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FeedbackMessages, useFeedback } from '../../components/ui/Feedback';
import { useAuth } from '../../hooks/useAuth';

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
  const feedback = useFeedback();
  const { can } = useAuth();
  return (
    <AppShell title="Reportes">
      <div className="grid gap-6">
        <FeedbackMessages feedback={feedback} />
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
              <Button
                className="mt-4 self-start"
                variant="secondary"
                onClick={() => {
                  const moduleName =
                    report.number === '01'
                      ? 'Eventos'
                      : report.number === '02'
                        ? 'Recursos'
                        : 'Presupuestos';
                  const permission =
                    report.number === '01'
                      ? 'eventos.ver'
                      : report.number === '02'
                        ? 'inventario.ver'
                        : 'presupuestos.ver';
                  feedback.guide(
                    `Este reporte aún no se puede generar ni descargar. ${can(permission) ? `Mientras tanto, consulta la información actual desde ${moduleName} en la navegación.` : `Para consultar esa información necesitas el permiso ${permission}. Solicita acceso al administrador de tu empresa.`}`,
                    report.title,
                  );
                }}
              >
                Cómo consultar esta información
              </Button>
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
