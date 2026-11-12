'use client';

import { EventTypesInput } from './EventTypesInput';
import { TenantFormStep } from './TenantFormStep';
import type {
  TenantContextUpdate,
  TenantOperationMode,
} from '../../services/tenants.service';

export type CreationContextDraft = {
  sector: string;
  operationalDescription: string;
  eventTypes: string;
  operationMode: TenantOperationMode | '';
  operationalNotes: string;
};

export const emptyCreationContext = (): CreationContextDraft => ({
  sector: '',
  operationalDescription: '',
  eventTypes: '',
  operationMode: '',
  operationalNotes: '',
});
const lines = (text: string) =>
  text
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
export function creationContextPayload(
  draft: CreationContextDraft,
): TenantContextUpdate {
  const eventTypes = lines(draft.eventTypes);
  return {
    ...(draft.sector.trim() && { sector: draft.sector.trim() }),
    ...(draft.operationalDescription.trim() && {
      operationalDescription: draft.operationalDescription.trim(),
    }),
    ...(eventTypes.length > 0 && { eventTypes }),
    ...(draft.operationMode && { operationMode: draft.operationMode }),
    ...(draft.operationalNotes.trim() && {
      operationalNotes: draft.operationalNotes.trim(),
    }),
  };
}

export function validateCreationContext(draft: CreationContextDraft): string[] {
  const eventTypes = lines(draft.eventTypes);
  const errors: string[] = [];
  if (!draft.sector.trim()) errors.push('Ingresa el sector de la empresa.');
  if (!draft.operationMode)
    errors.push('Selecciona la modalidad de operación.');
  if (!draft.operationalDescription.trim())
    errors.push('Ingresa la descripción de la operación.');
  if (!eventTypes.length) errors.push('Agrega al menos un tipo de evento.');
  if (eventTypes.length > 20 || eventTypes.some((item) => item.length > 80))
    errors.push(
      'Ingresa hasta 20 tipos de eventos de máximo 80 caracteres cada uno.',
    );
  return errors;
}

const inputClass =
  'w-full rounded-xl border border-sky-blue bg-white px-3 py-2 font-normal outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue';

export function TenantCreationContext({
  value,
  onChange,
}: {
  value: CreationContextDraft;
  onChange: (value: CreationContextDraft) => void;
}) {
  return (
    <div className="grid min-w-0 gap-4 sm:col-span-2 sm:grid-cols-2">
      <TenantFormStep number={2} title="Contexto operativo" />
      <label className="grid gap-2 text-sm font-semibold">
        Sector
        <input
          aria-label="Sector"
          required
          placeholder="Ej. Organización de eventos culturales"
          className={inputClass}
          maxLength={80}
          value={value.sector}
          onChange={(event) =>
            onChange({ ...value, sector: event.target.value })
          }
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        Modalidad de operación
        <select
          aria-label="Modalidad de operación"
          required
          className={inputClass}
          value={value.operationMode}
          onChange={(event) =>
            onChange({
              ...value,
              operationMode: event.target
                .value as CreationContextDraft['operationMode'],
            })
          }
        >
          <option value="">Selecciona una modalidad</option>
          <option value="propios">Eventos propios</option>
          <option value="clientes">Eventos para clientes</option>
          <option value="ambos">Ambos</option>
        </select>
      </label>
      <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
        Descripción de la operación
        <textarea
          aria-label="Descripción de la operación"
          required
          placeholder="Ej. Organizamos eventos culturales y coordinamos proveedores y logística."
          className={inputClass}
          maxLength={1500}
          rows={3}
          value={value.operationalDescription}
          onChange={(event) =>
            onChange({ ...value, operationalDescription: event.target.value })
          }
        />
      </label>
      <EventTypesInput
        required
        value={value.eventTypes}
        onChange={(eventTypes) => onChange({ ...value, eventTypes })}
      />
      <TenantFormStep number={3} title="Información adicional" />
      <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
        Notas operativas (opcional)
        <textarea
          aria-label="Notas operativas"
          placeholder="Ej. Trabajamos con proveedores externos según el evento."
          className={inputClass}
          maxLength={2000}
          rows={3}
          value={value.operationalNotes}
          onChange={(event) =>
            onChange({ ...value, operationalNotes: event.target.value })
          }
        />
      </label>
    </div>
  );
}
