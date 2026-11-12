'use client';

import { useId, useState } from 'react';
import { Button } from '../ui/Button';

export function EventTypesInput({
  value,
  onChange,
  readOnly = false,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  required?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const parts = value.split('\n');
  const editingDraft = adding && !readOnly;
  const entries = (editingDraft ? parts.slice(0, -1) : parts).filter((item) =>
    item.trim(),
  );
  const draft = editingDraft ? (parts.at(-1) ?? '') : '';

  function changeDraft(next: string) {
    onChange([...entries, next].join('\n'));
    setAdding(true);
  }

  function add() {
    if (!draft.trim() || entries.length >= 20) return;
    onChange([...entries, draft.trim()].join('\n'));
    setAdding(false);
    setOpen(false);
  }

  function remove(index: number) {
    const next = entries.filter((_, i) => i !== index);
    onChange([...next, ...(editingDraft ? [draft] : [])].join('\n'));
  }

  const visibleEntries = entries
    .map((entry, index) => ({ entry, index }))
    .filter(
      ({ entry }) =>
        !draft.trim() ||
        entry
          .toLocaleLowerCase('es-CO')
          .includes(draft.trim().toLocaleLowerCase('es-CO')),
    );

  return (
    <fieldset className="grid min-w-0 gap-3 sm:col-span-2">
      <legend className="text-sm font-semibold">Tipos de eventos</legend>
      <div className="flex min-w-0 flex-wrap gap-2 sm:flex-nowrap">
        <div className="relative min-w-0 flex-1">
          <input
            aria-label={readOnly ? 'Tipos de eventos' : 'Nuevo tipo de evento'}
            aria-required={required && entries.length === 0}
            className="w-full rounded-xl border border-sky-blue bg-white py-2 pr-12 pl-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
            maxLength={80}
            placeholder={readOnly ? 'Ver tipos de eventos' : 'Ej. Feria'}
            value={draft}
            readOnly={readOnly}
            disabled={!readOnly && entries.length >= 20}
            onChange={(event) => changeDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                add();
              }
            }}
          />
          <button
            type="button"
            aria-label={
              open
                ? 'Ocultar tipos de eventos agregados'
                : 'Mostrar tipos de eventos agregados'
            }
            aria-expanded={open}
            aria-controls={listId}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-violet transition hover:bg-violet/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            onClick={() => setOpen((current) => !current)}
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 7 5 16h14L12 7Z" />
            </svg>
          </button>
          {open && (
            <div
              id={listId}
              role="region"
              aria-label="Tipos de eventos agregados"
              className="absolute bottom-full z-20 mb-2 max-h-52 w-full overflow-y-auto rounded-xl border border-sky-blue bg-white p-2 shadow-xl"
            >
              {visibleEntries.length ? (
                <ul>
                  {visibleEntries.map(({ entry, index }) => (
                    <li
                      key={`${index}-${entry}`}
                      className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm hover:bg-violet/5"
                    >
                      <span className="min-w-0 break-words">{entry}</span>
                      {!readOnly && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="shrink-0 px-2 py-1"
                          aria-label={`Eliminar ${entry}`}
                          onClick={() => remove(index)}
                        >
                          Eliminar
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-2 text-sm text-muted">
                  {entries.length
                    ? 'No hay tipos que coincidan.'
                    : 'Aún no hay tipos agregados.'}
                </p>
              )}
            </div>
          )}
        </div>
        {!readOnly && (
          <Button
            type="button"
            disabled={!draft.trim() || entries.length >= 20}
            onClick={add}
          >
            Añadir
          </Button>
        )}
      </div>
    </fieldset>
  );
}
