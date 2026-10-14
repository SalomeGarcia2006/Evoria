import { AppShell } from '../../../components/layout/AppShell';
import { ModulePlaceholder } from '../../../components/ui/ModulePlaceholder';

export default async function RecursoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AppShell title="Detalle del recurso">
      <ModulePlaceholder
        title={`Recurso ${id}`}
        description="Detalle preparado para integrar el contrato de recursos."
      />
    </AppShell>
  );
}
