'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '../ui/Button';

export function ProviderDialogShell({
  title,
  busy,
  onClose,
  children,
  size = 'default',
  footer,
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: 'default' | 'wide';
  footer?: ReactNode;
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
      aria-labelledby={id}
      aria-modal="true"
      aria-busy={busy}
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        if (!busy) onClose();
      }}
      className={`m-auto max-h-[calc(100dvh-2rem)] w-11/12 ${size === 'wide' ? 'max-w-6xl p-0 motion-safe:animate-[login-alert-appear_0.2s_ease-out]' : 'max-w-3xl p-4 sm:p-6'} overflow-y-auto overscroll-contain rounded-2xl border border-sky-blue bg-white text-navy shadow-2xl backdrop:bg-navy/60`}
    >
      <div
        className={
          size === 'wide'
            ? 'sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-sky-blue bg-white p-4 sm:px-6 sm:py-5'
            : 'mb-5 flex items-start justify-between gap-4'
        }
      >
        <h2 id={id} className="min-w-0 break-words text-2xl font-bold">
          {title}
        </h2>
        <Button
          type="button"
          variant="ghost"
          aria-label="Cerrar ventana"
          className="grid size-10 shrink-0 place-items-center p-0 text-2xl leading-none focus-visible:outline-2 focus-visible:outline-teal disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </Button>
      </div>
      {size === 'wide' ? (
        <div className="p-4 sm:p-6">{children}</div>
      ) : (
        children
      )}
      {footer && (
        <footer className="sticky bottom-0 z-10 border-t border-sky-blue bg-white p-4 sm:px-6">
          {footer}
        </footer>
      )}
    </dialog>
  );
}
