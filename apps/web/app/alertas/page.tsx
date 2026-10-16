import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';

export default function AlertasPage() {
  return (
    <AppShell title="Alertas">
      <div className="grid gap-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[.16em] text-teal">
            Seguimiento
          </p>
          <h2 className="mt-2 text-3xl font-bold">Centro de alertas</h2>
          <p className="mt-1 text-teal">
            Un espacio para revisar avisos importantes de la operación.
          </p>
        </div>
        <Card className="mx-auto w-full max-w-2xl py-12 text-center">
          <span
            aria-hidden="true"
            className="mx-auto grid size-14 place-items-center rounded-2xl bg-sky-blue/40 text-2xl text-teal"
          >
            ◷
          </span>
          <h3 className="mt-5 text-xl font-bold">Módulo en preparación</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-teal">
            La pantalla está lista para recibir las alertas cuando el equipo
            backend confirme la consulta, sus estados y las acciones
            disponibles.
          </p>
          <p className="mt-5 inline-flex rounded-full bg-beige px-3 py-1.5 text-xs font-medium text-teal">
            Sin datos ni acciones simuladas
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
