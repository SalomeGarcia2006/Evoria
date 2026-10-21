'use client';

import Link from 'next/link';
import { AppShell } from '../../../components/layout/AppShell';
import { ResourceForm } from '../../../components/resources/ResourceForm';

export default function NuevoRecursoPage() {
  return (
    <AppShell title="Nuevo recurso">
      <div className="mx-auto grid max-w-3xl gap-6">
        <div>
          <Link
            className="text-sm font-semibold text-teal hover:underline"
            href="/recursos"
          >
            ← Volver a recursos
          </Link>
          <h2 className="mt-4 text-3xl font-bold">Registrar recurso</h2>
          <p className="mt-1 text-teal">
            Completa la información para organizar el catálogo.
          </p>
        </div>
        <ResourceForm />
      </div>
    </AppShell>
  );
}
