'use client';

import { useEffect, useId, useRef } from 'react';

export function ServiceValidationDialog({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
      data-testid="feedback-modal"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="login-alert-backdrop fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto border-0 p-6 text-navy backdrop:bg-transparent"
    >
      <div className="grid min-h-full place-items-center">
        <div className="login-alert-modal">
          <button
            aria-label="Cerrar alerta"
            className="login-alert-close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
          <div className="login-alert-icon" aria-hidden="true">
            ⚠️
          </div>
          <p id={`${id}-title`} className="login-alert-kicker">
            Revisa los datos del servicio
          </p>
          <p
            id={`${id}-message`}
            className="login-alert-message whitespace-pre-line"
          >
            {message}
          </p>
          <button
            className="login-alert-button"
            onClick={onClose}
            type="button"
          >
            Entendido
          </button>
        </div>
      </div>
    </dialog>
  );
}
