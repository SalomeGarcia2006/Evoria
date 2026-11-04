'use client';
import { useId, useState, type FormEvent } from 'react';
import type {
  BudgetRequest,
  BudgetRequestType,
  EventBudgetDetail,
} from '@evoria/contracts';
import { ProviderDialogShell } from '../providers/ProviderDialogShell';
import { Field, inputClass } from '../providers/fields';
import { Button } from '../ui/Button';
import { ErrorMessage } from '../ui/ErrorMessage';
import { apiErrorMessage } from '../../services/api';
import {
  initializeBudget,
  submitBudgetRequest,
  approveBudgetRequest,
  rejectBudgetRequest,
} from '../../services/presupuestos.service';
import { BudgetAmountsView, cop, requestLabels } from './BudgetAmountsView';

export type BudgetAction =
  | { kind: 'initialize' }
  | { kind: 'request' }
  | { kind: 'approve' | 'reject'; request: BudgetRequest };
export function BudgetActionDialog({
  action,
  budget,
  onClose,
  onSaved,
  onConflict,
}: {
  action: BudgetAction;
  budget: EventBudgetDetail;
  onClose: () => void;
  onSaved: (message: string) => void;
  onConflict: () => void;
}) {
  const [amount, setAmount] = useState('');
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [type, setType] = useState<BudgetRequestType>('ampliacion');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const decision = action.kind === 'approve' || action.kind === 'reject';
  const staleDecision =
    decision &&
    budget.requests.find((request) => request.id === action.request.id)
      ?.status !== 'pendiente';
  const blocked =
    budget.eventStatus === 'cancelado' ||
    staleDecision ||
    (action.kind === 'initialize' && budget.initialized);
  const title =
    action.kind === 'initialize'
      ? 'Iniciar presupuesto'
      : action.kind === 'request'
        ? 'Solicitar cambio de presupuesto'
        : action.kind === 'approve'
          ? 'Confirmar aprobación'
          : 'Confirmar rechazo';
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || blocked) return;
    const next: Record<string, string> = {};
    const value = Number(amount);
    if (
      !decision &&
      (!/^\d+$/.test(amount) ||
        !Number.isSafeInteger(value) ||
        value < (action.kind === 'initialize' ? 0 : 1))
    )
      next.amount =
        action.kind === 'initialize'
          ? 'Ingresa un entero no negativo en COP.'
          : 'Ingresa un entero positivo en COP.';
    if (
      (action.kind === 'request' || action.kind === 'reject') &&
      reason.trim().length < 10
    )
      next.reason = 'Escribe un motivo de al menos diez caracteres.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError('');
    try {
      if (action.kind === 'initialize')
        await initializeBudget(budget.eventId, value);
      else if (action.kind === 'request')
        await submitBudgetRequest(budget.eventId, {
          type,
          amountCop: value,
          reason: reason.trim(),
        });
      else if (action.kind === 'approve')
        await approveBudgetRequest(budget.eventId, action.request.id);
      else
        await rejectBudgetRequest(
          budget.eventId,
          action.request.id,
          reason.trim(),
        );
      onSaved(
        action.kind === 'request'
          ? 'Solicitud enviada. Sigue pendiente y todavía no modifica el saldo.'
          : action.kind === 'initialize'
            ? 'Presupuesto iniciado correctamente.'
            : action.kind === 'approve'
              ? 'Solicitud aprobada. El presupuesto se actualizará con la decisión.'
              : 'Solicitud rechazada. El saldo no cambia.',
      );
    } catch (error) {
      setError(apiErrorMessage(error));
      onConflict();
    } finally {
      setBusy(false);
    }
  }
  return (
    <ProviderDialogShell title={title} busy={busy} onClose={onClose}>
      <form noValidate onSubmit={submit} className="grid gap-5">
        <p className="font-semibold">{budget.eventName}</p>
        {error && <ErrorMessage message={error} />}
        {blocked && (
          <p
            role="status"
            className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
          >
            Los datos cambiaron: el evento está cancelado, el presupuesto ya se
            inició o la solicitud ya fue decidida. Puedes cerrar esta ventana y
            consultar el historial actualizado.
          </p>
        )}
        {decision && (
          <>
            <BudgetAmountsView budget={budget} />
            <p>
              {requestLabels[action.request.type]} por{' '}
              <strong>{cop(action.request.amountCop)}</strong>
            </p>
            <p className="whitespace-pre-wrap break-words">
              {action.request.reason}
            </p>
            <p className="rounded-lg bg-beige p-3 text-sm">
              {action.kind === 'reject'
                ? 'El rechazo quedará registrado con tu motivo y no modificará el saldo.'
                : action.request.type === 'ampliacion'
                  ? 'Al confirmar, aumentará el total asignado y el saldo disponible.'
                  : 'Al confirmar, aumentará el gasto adicional y disminuirá el saldo disponible. Solo podrá aprobarse si hay saldo suficiente.'}
            </p>
          </>
        )}
        <fieldset disabled={busy} className="grid gap-4">
          {action.kind === 'request' && (
            <label className="grid gap-2 text-sm font-semibold">
              Tipo de solicitud
              <select
                className={inputClass}
                value={type}
                onChange={(event) =>
                  setType(event.target.value as BudgetRequestType)
                }
              >
                <option value="ampliacion">Ampliación de presupuesto</option>
                <option value="costo_adicional">Costo adicional</option>
              </select>
            </label>
          )}
          {!decision && (
            <Field
              label={
                action.kind === 'initialize'
                  ? 'Presupuesto base (COP)'
                  : 'Monto solicitado (COP)'
              }
              value={amount}
              inputMode="numeric"
              error={errors.amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          )}
          {(action.kind === 'request' || action.kind === 'reject') && (
            <div className="grid gap-2 text-sm font-semibold">
              <label htmlFor={reasonId}>
                {action.kind === 'reject' ? 'Motivo de rechazo' : 'Motivo'}
              </label>
              <textarea
                id={reasonId}
                className={inputClass}
                value={reason}
                minLength={10}
                maxLength={1000}
                aria-invalid={!!errors.reason}
                aria-describedby={
                  errors.reason ? `${reasonId}-error` : undefined
                }
                onChange={(event) => setReason(event.target.value)}
              />
              {errors.reason && (
                <span id={`${reasonId}-error`} className="text-red-700">
                  {errors.reason}
                </span>
              )}
            </div>
          )}
        </fieldset>
        {action.kind === 'initialize' && (
          <p className="text-sm text-teal">
            Este monto se sincroniza con el presupuesto base del evento. Debe
            cubrir los gastos ya registrados. Solo puede iniciarse una vez.
          </p>
        )}
        {action.kind === 'request' && (
          <p className="text-sm text-teal">
            El líder responsable decidirá la solicitud. Mientras esté pendiente
            no cambia los totales ni el saldo.
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Volver
          </Button>
          <Button disabled={busy || blocked}>
            {busy
              ? 'Guardando…'
              : action.kind === 'approve'
                ? 'Confirmar aprobación'
                : action.kind === 'reject'
                  ? 'Confirmar rechazo'
                  : action.kind === 'initialize'
                    ? 'Iniciar presupuesto'
                    : 'Enviar solicitud'}
          </Button>
        </div>
      </form>
    </ProviderDialogShell>
  );
}
