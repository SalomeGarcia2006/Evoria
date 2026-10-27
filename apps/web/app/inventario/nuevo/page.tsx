'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../../components/layout/AppShell';
import { Card } from '../../../components/ui/Card';
import { PermissionGate } from '../../../components/auth/PermissionGate';
import { ResourceForm } from '../../../components/resources/ResourceForm';

export default function NuevoRecursoPage() {
  const router = useRouter();
  return (
    <AppShell title="Nuevo recurso">
      <div className="mx-auto grid max-w-3xl gap-6">
        <Link
          className="text-sm font-semibold text-teal hover:underline"
          href="/inventario"
        >
          ← Volver al inventario
        </Link>
        <h2 className="text-3xl font-bold">Registrar recurso</h2>
        <PermissionGate permission="inventario.ajustar">
          <Card>
            <ResourceForm
              onSaved={(resource) => router.push(`/inventario/${resource.id}`)}
              onCancel={() => router.push('/inventario')}
            />
          </Card>
        </PermissionGate>
      </div>
    </AppShell>
  );
}
