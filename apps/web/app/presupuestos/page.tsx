'use client';
import { Suspense } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { LoadingState } from '../../components/ui/LoadingState';
import { BudgetsWorkspace } from '../../components/budgets/BudgetsWorkspace';
export default function PresupuestosPage() {
  return (
    <AppShell title="Presupuestos">
      <Suspense fallback={<LoadingState label="Cargando presupuestos…" />}>
        <BudgetsWorkspace />
      </Suspense>
    </AppShell>
  );
}
