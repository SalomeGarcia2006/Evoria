import { AppShell } from '../../components/layout/AppShell';
import { ModulePlaceholder } from '../../components/ui/ModulePlaceholder';

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard">
      <ModulePlaceholder
        title="Dashboard"
        description="Espacio preparado para las métricas del sistema."
      />
    </AppShell>
  );
}
