import { AppShell } from '../../../components/layout/AppShell';
import { ModulePlaceholder } from '../../../components/ui/ModulePlaceholder';

export default function NuevoEventoPage() {
  return (
    <AppShell title="Nuevo evento">
      <ModulePlaceholder
        title="Nuevo evento"
        description="Formulario de eventos pendiente de integración con la API."
      />
    </AppShell>
  );
}
