import { AppShell } from '../../../components/layout/AppShell';
import { EventForm } from '../../../components/events/EventForm';

export default function NuevoEventoPage() {
  return (
    <AppShell title="Nuevo evento">
      <div className="grid gap-6">
        <div>
          <h1 className="text-2xl font-bold">Nuevo evento</h1>
          <p className="mt-1 text-sm text-teal">
            Registra la información principal del evento.
          </p>
        </div>
        <EventForm />
      </div>
    </AppShell>
  );
}
