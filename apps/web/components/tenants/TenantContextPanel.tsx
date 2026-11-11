'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { apiErrorMessage } from '../../services/api';
import {
  getTenantContext,
  updateTenantContext,
  type TenantContext,
  type TenantContextUpdate,
} from '../../services/tenants.service';
import { Button } from '../ui/Button';
import { FeedbackMessages, useFeedback } from '../ui/Feedback';
import { LoadingState } from '../ui/LoadingState';
import panelHeadingStyles from '../ui/PanelHeading.module.css';
import cardStyles from '../ui/InventoryStyleCard.module.css';

type AreaDraft = {
  name: string;
  description: string;
  responsibilities: string;
  authorizations: string;
};
type Draft = {
  sector: string;
  operationalDescription: string;
  eventTypes: string;
  operationMode: TenantContext['operationMode'];
  operationalAreas: AreaDraft[];
  operationalNotes: string;
};
const inputClass =
  'w-full rounded-xl border border-sky-blue bg-white px-3 py-2 font-normal outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue';
const lines = (value: string) =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
const toDraft = (context: TenantContext): Draft => ({
  sector: context.sector ?? '',
  operationalDescription: context.operationalDescription ?? '',
  eventTypes: context.eventTypes.join('\n'),
  operationMode: context.operationMode,
  operationalAreas: context.operationalAreas.map((area) => ({
    name: area.name,
    description: area.description ?? '',
    responsibilities: area.responsibilities.join('\n'),
    authorizations: area.authorizations.join('\n'),
  })),
  operationalNotes: context.operationalNotes ?? '',
});
const toPayload = (draft: Draft): Required<TenantContextUpdate> => ({
  sector: draft.sector.trim(),
  operationalDescription: draft.operationalDescription.trim(),
  eventTypes: lines(draft.eventTypes),
  operationMode: draft.operationMode,
  operationalAreas: draft.operationalAreas.map((area) => ({
    name: area.name.trim(),
    description: area.description.trim(),
    responsibilities: lines(area.responsibilities),
    authorizations: lines(area.authorizations),
  })),
  operationalNotes: draft.operationalNotes.trim(),
});

export function TenantContextPanel() {
  const { user } = useAuth();
  const allowed = user?.permissions.includes('empresa_contexto.ver') ?? false;
  const editable =
    user?.permissions.includes('empresa_contexto.editar') ?? false;
  const [context, setContext] = useState<TenantContext>();
  const [draft, setDraft] = useState<Draft>();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const feedback = useFeedback();

  useEffect(() => {
    if (!allowed || user?.scope !== 'tenant') return;
    let active = true;
    getTenantContext()
      .then((value) => {
        if (active) {
          setContext(value);
          setDraft(toDraft(value));
          setError('');
        }
      })
      .catch((err: unknown) => {
        if (active) setError(apiErrorMessage(err));
      });
    return () => {
      active = false;
    };
  }, [allowed, user?.scope, user?.tenant?.id, attempt]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !context || busy || !editable) return;
    const payload = toPayload(draft);
    if (
      payload.eventTypes.length > 20 ||
      payload.eventTypes.some((item) => item.length > 80) ||
      payload.operationalAreas.length > 20 ||
      payload.operationalAreas.some(
        (area) =>
          area.name.length < 2 ||
          area.responsibilities.length > 20 ||
          area.authorizations.length > 20 ||
          [...area.responsibilities, ...area.authorizations].some(
            (item) => item.length > 250,
          ),
      )
    ) {
      feedback.guide(
        'Revisa las áreas y listas: cada área necesita un nombre de al menos 2 caracteres; se permiten hasta 20 elementos por lista y área. Los tipos de evento admiten hasta 80 caracteres y las responsabilidades y autorizaciones hasta 250.',
        'Revisa la información',
      );
      return;
    }
    const original = toPayload(toDraft(context));
    const changes = Object.fromEntries(
      (Object.keys(payload) as (keyof typeof payload)[])
        .filter(
          (key) =>
            JSON.stringify(payload[key]) !== JSON.stringify(original[key]),
        )
        .map((key) => [key, payload[key]]),
    ) as TenantContextUpdate;
    if (!Object.keys(changes).length) {
      feedback.guide(
        'Modifica algún dato antes de actualizar el contexto.',
        'Sin cambios',
      );
      return;
    }
    setBusy(true);
    try {
      const updated = await updateTenantContext(changes);
      setContext(updated);
      setDraft(toDraft(updated));
      setEditing(false);
      feedback.notify('El contexto operativo se actualizó correctamente.');
    } catch (err) {
      feedback.notify(apiErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) return null;
  return (
    <section className="module-panel" aria-label="Contexto operativo">
      <FeedbackMessages feedback={feedback} />
      <div className={`module-panel__heading ${panelHeadingStyles.heading}`}>
        <h2 className="text-xl font-bold">Contexto operativo</h2>
        <p className="mt-1 text-sm text-muted">
          Describe cómo trabaja tu empresa para orientar la organización de sus
          perfiles.
        </p>
      </div>
      <div className="module-panel__content">
        {error && !context ? (
          <div>
            <p role="alert" className="text-sm text-red-800">
              {error}
            </p>
            <Button
              className="mt-3"
              variant="secondary"
              onClick={() => {
                setError('');
                setAttempt((v) => v + 1);
              }}
            >
              Reintentar
            </Button>
          </div>
        ) : !draft || !context ? (
          <LoadingState label="Cargando contexto operativo…" />
        ) : (
          <form onSubmit={save} className="grid gap-5">
            <fieldset
              disabled={!editing || busy}
              className="grid min-w-0 gap-5 sm:grid-cols-2"
            >
              <label className="grid gap-2 text-sm font-semibold">
                Sector
                <input
                  className={inputClass}
                  maxLength={80}
                  value={draft.sector}
                  onChange={(e) =>
                    setDraft({ ...draft, sector: e.target.value })
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Modalidad de operación
                <select
                  className={inputClass}
                  value={draft.operationMode ?? ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      operationMode: (e.target.value ||
                        null) as Draft['operationMode'],
                    })
                  }
                >
                  <option value="">Sin definir</option>
                  <option value="propios">Eventos propios</option>
                  <option value="clientes">Eventos para clientes</option>
                  <option value="ambos">Ambos</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                Descripción de la operación
                <textarea
                  className={inputClass}
                  maxLength={1500}
                  rows={3}
                  value={draft.operationalDescription}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      operationalDescription: e.target.value,
                    })
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                Tipos de eventos{' '}
                <span className="font-normal text-muted">Uno por línea.</span>
                <textarea
                  className={inputClass}
                  rows={3}
                  value={draft.eventTypes}
                  onChange={(e) =>
                    setDraft({ ...draft, eventTypes: e.target.value })
                  }
                />
              </label>
              <div className="grid gap-3 sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-bold">Áreas operativas</h3>
                  {editing && (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={draft.operationalAreas.length >= 20}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          operationalAreas: [
                            ...draft.operationalAreas,
                            {
                              name: '',
                              description: '',
                              responsibilities: '',
                              authorizations: '',
                            },
                          ],
                        })
                      }
                    >
                      Añadir área
                    </Button>
                  )}
                </div>
                {!draft.operationalAreas.length && (
                  <p className="text-sm text-muted">
                    No hay áreas registradas.
                  </p>
                )}
                {draft.operationalAreas.map((area, index) => {
                  const change = (field: keyof AreaDraft, value: string) =>
                    setDraft({
                      ...draft,
                      operationalAreas: draft.operationalAreas.map((item, i) =>
                        i === index ? { ...item, [field]: value } : item,
                      ),
                    });
                  return (
                    <fieldset
                      key={index}
                      className={`${cardStyles.card} grid gap-4 sm:grid-cols-2`}
                    >
                      <legend className="px-1 font-semibold">
                        Área {index + 1}
                      </legend>
                      <label className="grid gap-2 text-sm font-semibold">
                        Nombre del área
                        <input
                          className={inputClass}
                          maxLength={80}
                          value={area.name}
                          onChange={(e) => change('name', e.target.value)}
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-semibold">
                        Descripción del área
                        <input
                          className={inputClass}
                          maxLength={500}
                          value={area.description}
                          onChange={(e) =>
                            change('description', e.target.value)
                          }
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-semibold">
                        Responsabilidades{' '}
                        <span className="font-normal text-muted">
                          Una por línea.
                        </span>
                        <textarea
                          className={inputClass}
                          rows={3}
                          value={area.responsibilities}
                          onChange={(e) =>
                            change('responsibilities', e.target.value)
                          }
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-semibold">
                        Autorizaciones{' '}
                        <span className="font-normal text-muted">
                          Una por línea.
                        </span>
                        <textarea
                          className={inputClass}
                          rows={3}
                          value={area.authorizations}
                          onChange={(e) =>
                            change('authorizations', e.target.value)
                          }
                        />
                      </label>
                      {editing && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="justify-self-start"
                          aria-label={`Eliminar área ${index + 1}`}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              operationalAreas: draft.operationalAreas.filter(
                                (_, i) => i !== index,
                              ),
                            })
                          }
                        >
                          Eliminar área
                        </Button>
                      )}
                    </fieldset>
                  );
                })}
              </div>
              <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                Notas operativas
                <textarea
                  className={inputClass}
                  maxLength={2000}
                  rows={3}
                  value={draft.operationalNotes}
                  onChange={(e) =>
                    setDraft({ ...draft, operationalNotes: e.target.value })
                  }
                />
              </label>
            </fieldset>
            {editable &&
              (editing ? (
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={busy}>
                    {busy ? 'Actualizando…' : 'Actualizar información'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      setDraft(toDraft(context));
                      setEditing(false);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  className="justify-self-start"
                  onClick={() => setEditing(true)}
                >
                  Editar contexto
                </Button>
              ))}
          </form>
        )}
      </div>
    </section>
  );
}
