'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '../ui/Button';

export function ProviderDialogShell({
  title,
  busy,
  onClose,
  children,
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      aria-busy={busy}
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-11/12 max-w-3xl overflow-y-auto rounded-2xl border border-sky-blue bg-white p-6 text-navy shadow-2xl backdrop:bg-navy/60"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <h2 id={id} className="text-2xl font-bold">
          {title}
        </h2>
        <Button
          type="button"
          variant="ghost"
          aria-label="Cerrar ventana"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </Button>
      </div>
      {children}
    </dialog>
  );
}
