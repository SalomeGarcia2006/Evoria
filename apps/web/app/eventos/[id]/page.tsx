import { AppShell } from '../../../components/layout/AppShell';
import { ModulePlaceholder } from '../../../components/ui/ModulePlaceholder';

export default async function EventoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AppShell title="Detalle del evento">
      <ModulePlaceholder
        title={`Evento ${id}`}
        description="Detalle preparado para integrar el contrato de eventos."
      />
    </AppShell>
  );
}
