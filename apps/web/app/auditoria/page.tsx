import { AppShell } from '../../components/layout/AppShell';
import { ModulePlaceholder } from '../../components/ui/ModulePlaceholder';

export default function AuditoriaPage() {
  return (
    <AppShell title="Auditoría">
      <ModulePlaceholder
        title="Auditoría"
        description="Módulo preparado para la futura integración de auditoría."
      />
    </AppShell>
  );
}
