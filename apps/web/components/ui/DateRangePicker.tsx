'use client';

import { useState } from 'react';

type DateRangePickerProps = {
  label: string;
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
};

const weekdays = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

function toDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value: string): string {
  const date = toDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function DateRangePicker({
  label,
  startDate,
  endDate,
  onChange,
  min,
  max,
  required = false,
}: DateRangePickerProps) {
  const initialMonth = toDate(startDate) ?? toDate(min ?? '') ?? new Date();
  const [visibleMonth, setVisibleMonth] = useState(() =>
    monthStart(initialMonth),
  );
  const minDate = toDate(min ?? '');
  const maxDate = toDate(max ?? '');
  const daysInMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0,
  ).getDate();
  const firstWeekday = (visibleMonth.getDay() + 6) % 7;
  const days = Array.from({ length: firstWeekday + daysInMonth }, (_, index) =>
    index < firstWeekday
      ? null
      : new Date(
          visibleMonth.getFullYear(),
          visibleMonth.getMonth(),
          index - firstWeekday + 1,
        ),
  );

  function selectDate(value: string) {
    if (!startDate || endDate) {
      onChange(value, '');
      return;
    }
    onChange(startDate, value);
  }

  const selectedLabel = startDate
    ? endDate
      ? `${formatDate(startDate)} — ${formatDate(endDate)}`
      : `${formatDate(startDate)} — Selecciona la fecha de finalización`
    : 'Selecciona fecha de inicio y finalización';

  return (
    <section
      aria-label="Seleccionar rango de fechas"
      className="grid w-full gap-3 rounded-[1.25rem] border border-sky-blue bg-beige/45 p-4 sm:col-span-2 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
        </span>
        <span
          className={
            startDate ? 'text-sm font-semibold text-navy' : 'text-sm text-muted'
          }
        >
          {selectedLabel}
        </span>
      </div>
      <div className="rounded-[1rem] border border-sky-blue bg-white p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <button
            aria-label="Mes anterior"
            className="grid size-9 place-items-center rounded-xl border border-sky-blue text-lg text-navy transition hover:border-teal hover:bg-beige"
            onClick={() =>
              setVisibleMonth(
                (current) =>
                  new Date(current.getFullYear(), current.getMonth() - 1, 1),
              )
            }
            type="button"
          >
            ‹
          </button>
          <p className="font-display font-bold capitalize text-navy">
            {new Intl.DateTimeFormat('es-CO', {
              month: 'long',
              year: 'numeric',
            }).format(visibleMonth)}
          </p>
          <button
            aria-label="Mes siguiente"
            className="grid size-9 place-items-center rounded-xl border border-sky-blue text-lg text-navy transition hover:border-teal hover:bg-beige"
            onClick={() =>
              setVisibleMonth(
                (current) =>
                  new Date(current.getFullYear(), current.getMonth() + 1, 1),
              )
            }
            type="button"
          >
            ›
          </button>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs">
          {weekdays.map((day) => (
            <span className="py-1 font-semibold text-muted" key={day}>
              {day}
            </span>
          ))}
          {days.map((date, index) => {
            if (!date) return <span key={`empty-${index}`} />;
            const value = toDateValue(date);
            const disabled = Boolean(
              (minDate && date < minDate) ||
              (maxDate && date > maxDate) ||
              (startDate && !endDate && value < startDate),
            );
            const isStart = value === startDate;
            const isEnd = value === endDate;
            const isBetween = Boolean(
              startDate && endDate && value > startDate && value < endDate,
            );
            return (
              <button
                aria-label={formatDate(value)}
                aria-pressed={isStart || isEnd}
                className={`h-9 rounded-lg text-sm font-medium transition ${
                  isStart || isEnd
                    ? 'bg-linear-to-br from-teal to-violet text-white shadow-sm'
                    : isBetween
                      ? 'bg-violet/10 text-violet'
                      : 'text-navy hover:bg-beige'
                } disabled:cursor-not-allowed disabled:text-muted/40 disabled:hover:bg-transparent`}
                disabled={disabled}
                key={value}
                onClick={() => selectDate(value)}
                type="button"
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-sky-blue pt-3">
          <p className="text-xs text-muted">
            Primero inicio, luego finalización.
          </p>
          {startDate || endDate ? (
            <button
              className="text-xs font-semibold text-violet hover:underline"
              onClick={() => onChange('', '')}
              type="button"
            >
              Limpiar
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
