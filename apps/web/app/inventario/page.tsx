import { AppShell } from '../../components/layout/AppShell';
import { ModulePlaceholder } from '../../components/ui/ModulePlaceholder';

export default function InventarioPage() {
  return (
    <AppShell title="Inventario">
      <ModulePlaceholder
        title="Inventario"
        description="Espacio preparado para movimientos y existencias."
      />
    </AppShell>
  );
}
