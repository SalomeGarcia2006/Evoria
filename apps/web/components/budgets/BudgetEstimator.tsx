'use client';
import { useState } from 'react';
import { Card } from '../ui/Card';
import { Field } from '../providers/fields';
import { cop } from './BudgetAmountsView';
export function BudgetEstimator() {
  const [resources, setResources] = useState('');
  const [extra, setExtra] = useState('');
  return (
    <Card>
      <details>
        <summary className="cursor-pointer font-bold">
          Calculadora de presupuesto
        </summary>
        <p className="mt-3 text-sm text-teal">
          Estima costos antes de asignarlos. Este cálculo no guarda datos ni
          modifica el saldo del evento.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="Costos de recursos"
            type="number"
            min="0"
            value={resources}
            onChange={(event) => setResources(event.target.value)}
          />
          <Field
            label="Costos adicionales"
            type="number"
            min="0"
            value={extra}
            onChange={(event) => setExtra(event.target.value)}
          />
        </div>
        <p className="mt-4 font-bold">
          Total estimado:{' '}
          {cop(
            Math.max(0, Number(resources) || 0) +
              Math.max(0, Number(extra) || 0),
          )}
        </p>
      </details>
    </Card>
  );
}
