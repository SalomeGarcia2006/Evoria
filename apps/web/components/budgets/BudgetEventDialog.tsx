'use client';

import { useCallback, useState } from 'react';
import type { EventBudgetDetail } from '@evoria/contracts';
import { ProviderDialogShell } from '../providers/ProviderDialogShell';
import { Button } from '../ui/Button';
import { BudgetPanel } from './BudgetPanel';

export function BudgetEventDialog({
  eventId,
  revision,
  onChanged,
  onClose,
}: {
  eventId: string;
  revision: number;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const onLoaded = useCallback(
    (budget: EventBudgetDetail) => setName(budget.eventName),
    [],
  );
  return (
    <ProviderDialogShell
      title={name ? `Presupuesto · ${name}` : 'Presupuesto del evento'}
      size="wide"
      busy={busy}
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cerrar presupuesto
          </Button>
        </div>
      }
    >
      <section aria-label="Detalle del presupuesto">
        <BudgetPanel
          key={eventId}
          eventId={eventId}
          revision={revision}
          onChanged={onChanged}
          onLoaded={onLoaded}
          onBusyChange={setBusy}
        />
      </section>
    </ProviderDialogShell>
  );
}
