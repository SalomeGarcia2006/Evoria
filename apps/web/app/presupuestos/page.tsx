import { AppShell } from '../../components/layout/AppShell';
import { ModulePlaceholder } from '../../components/ui/ModulePlaceholder';

export default function PresupuestosPage() {
  return (
    <AppShell title="Presupuestos">
      <ModulePlaceholder
        title="Presupuestos"
        description="Espacio preparado para la gestión de presupuestos."
      />
    </AppShell>
  );
}
