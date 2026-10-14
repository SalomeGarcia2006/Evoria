import { AppShell } from '../../../components/layout/AppShell';
import { ModulePlaceholder } from '../../../components/ui/ModulePlaceholder';

export default function NuevoRecursoPage() {
  return (
    <AppShell title="Nuevo recurso">
      <ModulePlaceholder
        title="Nuevo recurso"
        description="Formulario de recursos pendiente de integración con la API."
      />
    </AppShell>
  );
}
