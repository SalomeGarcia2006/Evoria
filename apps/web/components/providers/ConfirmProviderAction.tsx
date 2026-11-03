'use client';
import { useState } from 'react';
import { Button } from '../ui/Button';
import { ErrorMessage } from '../ui/ErrorMessage';
import { ProviderDialogShell } from './ProviderDialogShell';

export function ConfirmProviderAction({
  title,
  description,
  action,
  onClose,
  onSaved,
}: {
  title: string;
  description: string;
  action: () => Promise<unknown>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No fue posible completar la operación.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <ProviderDialogShell title={title} busy={busy} onClose={onClose}>
      <div className="grid gap-5">
        <p>{description}</p>
        {error && <ErrorMessage message={error} />}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Volver
          </Button>
          <Button disabled={busy} onClick={confirm}>
            {busy ? 'Procesando…' : 'Confirmar'}
          </Button>
        </div>
      </div>
    </ProviderDialogShell>
  );
}
