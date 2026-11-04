'use client';
import { useState } from 'react';
import { Card } from '../ui/Card';
import { Field } from '../providers/fields';
import { cop } from './BudgetAmountsView';
import { FeedbackMessages, useFeedback } from '../ui/Feedback';
import { Button } from '../ui/Button';
export function BudgetEstimator() {
  const feedback = useFeedback();
  const [resources, setResources] = useState('');
  const [extra, setExtra] = useState('');
  return (
    <Card>
      <FeedbackMessages feedback={feedback} />
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
        <Button
          className="mt-4"
          onClick={() => {
            if (
              (!resources.trim() && !extra.trim()) ||
              [resources, extra].some(
                (value) => !Number.isFinite(Number(value)) || Number(value) < 0,
              )
            ) {
              feedback.guide(
                'Indica al menos un costo y usa montos no negativos para calcular la estimación.',
                'Revisa los costos',
              );
              return;
            }
            feedback.notify(
              'Estimación calculada. Este cálculo no guarda datos ni modifica el presupuesto.',
            );
          }}
        >
          Calcular estimación
        </Button>
      </details>
    </Card>
  );
}
