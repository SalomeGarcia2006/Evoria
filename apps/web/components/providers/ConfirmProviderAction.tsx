'use client';
import { useState } from 'react';
import { Button } from '../ui/Button';
import { ErrorMessage } from '../ui/ErrorMessage';
import { ProviderDialogShell } from './ProviderDialogShell';
import { apiErrorMessage } from '../../services/api';

export function ConfirmProviderAction({
  title,
  description,
  action,
  onClose,
  onSaved,
  onError,
  confirmationText = 'CANCELAR',
}: {
  title: string;
  description: string;
  action: () => Promise<unknown>;
  onClose: () => void;
  onSaved: () => void;
  onError?: (error: unknown) => void;
  confirmationText?: 'CANCELAR' | 'DESACTIVAR';
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const confirmationMatches =
    typedConfirmation.trim().toLocaleUpperCase('es-CO') === confirmationText;
  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
      onSaved();
    } catch (err) {
      if (onError) onError(err);
      else setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <ProviderDialogShell title={title} busy={busy} onClose={onClose}>
      <div className="grid gap-5">
        <p>{description}</p>
        <label className="grid gap-2 text-sm font-semibold">
          <span>
            Escribe <strong className="text-violet">{confirmationText}</strong>{' '}
            para continuar
          </span>
          <input
            aria-label={`Escribe ${confirmationText} para confirmar`}
            autoComplete="off"
            className="rounded-xl border border-sky-blue bg-white px-3 py-2 font-normal outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
            onChange={(event) => setTypedConfirmation(event.target.value)}
            placeholder={confirmationText}
            value={typedConfirmation}
          />
        </label>
        {error && <ErrorMessage message={error} />}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Volver
          </Button>
          <Button disabled={busy || !confirmationMatches} onClick={confirm}>
            {busy ? 'Procesando…' : 'Confirmar'}
          </Button>
        </div>
      </div>
    </ProviderDialogShell>
  );
}
