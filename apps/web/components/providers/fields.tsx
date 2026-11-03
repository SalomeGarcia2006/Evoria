import { useId, type InputHTMLAttributes } from 'react';
import type { ProviderCategory } from '@evoria/contracts';

export const categoryLabels: Record<ProviderCategory, string> = {
  transporte: 'Transporte',
  alimentacion: 'Alimentación',
  espacios: 'Espacios',
  decoracion: 'Decoración',
  audiovisual: 'Audiovisual',
  otros: 'Otros',
};
export const inputClass =
  'min-w-0 w-full rounded-lg border border-sky-blue bg-white p-3 font-normal';
export function Field({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = useId();
  return (
    <div className="grid min-w-0 gap-2 text-sm font-semibold">
      <label htmlFor={id}>{label}</label>
      <input
        {...props}
        id={id}
        className={inputClass}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <span id={`${id}-error`} className="text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
