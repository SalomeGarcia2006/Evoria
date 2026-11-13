'use client';

import { Button } from '../ui/Button';

export function ContextListInput({
  title,
  itemLabel,
  placeholder,
  value,
  onChange,
  maxLength,
  readOnly = false,
  required = false,
  className = '',
}: {
  title: string;
  itemLabel: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  readOnly?: boolean;
  required?: boolean;
  className?: string;
}) {
  const items = value === '' ? [''] : value.split('\n');

  function update(index: number, next: string) {
    onChange(items.map((item, i) => (i === index ? next : item)).join('\n'));
  }

  return (
    <fieldset className={`grid min-w-0 content-start gap-2 ${className}`}>
      <legend className="text-sm font-semibold">{title}</legend>
      <div className="grid gap-2">
        {items.map((item, index) => (
          <div key={index} className="flex min-w-0 items-start gap-2">
            <input
              aria-label={`${itemLabel} ${index + 1}`}
              aria-required={required && index === 0}
              className="min-w-0 flex-1 rounded-xl border border-sky-blue bg-white px-3 py-2 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
              disabled={readOnly}
              maxLength={maxLength}
              placeholder={placeholder}
              value={item}
              onChange={(event) => update(index, event.target.value)}
            />
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                aria-label={`Eliminar ${itemLabel.toLocaleLowerCase('es-CO')} ${index + 1}`}
                onClick={() =>
                  onChange(items.filter((_, i) => i !== index).join('\n'))
                }
              >
                Eliminar
              </Button>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <Button
          type="button"
          variant="secondary"
          className="justify-self-start"
          disabled={items.length >= 20}
          onClick={() => onChange(`${value}\n`)}
        >
          Añadir {itemLabel.toLocaleLowerCase('es-CO')}
        </Button>
      )}
    </fieldset>
  );
}
