'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { apiErrorMessage } from '../../services/api';
import {
  getTenantContext,
  getTenantRegistrationLink,
  rotateTenantRegistrationLink,
  updateTenantContext,
  type TenantContext,
  type TenantContextUpdate,
} from '../../services/tenants.service';
import { Button } from '../ui/Button';
import { FeedbackMessages, useFeedback } from '../ui/Feedback';
import { LoadingState } from '../ui/LoadingState';
import panelHeadingStyles from '../ui/PanelHeading.module.css';
import { EventTypesInput } from './EventTypesInput';
import styles from './TenantContextPanel.module.css';

type Draft = {
  emailDomain: string;
  sector: string;
  operationalDescription: string;
  eventTypes: string;
  operationMode: TenantContext['operationMode'];
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
  emailDomain: context.emailDomain ?? '',
  sector: context.sector ?? '',
  operationalDescription: context.operationalDescription ?? '',
  eventTypes: context.eventTypes.join('\n'),
  operationMode: context.operationMode,
  operationalNotes: context.operationalNotes ?? '',
});
const toPayload = (
  draft: Draft,
): Omit<Required<TenantContextUpdate>, 'operationalAreas'> => ({
  emailDomain: draft.emailDomain.trim().toLowerCase(),
  sector: draft.sector.trim(),
  operationalDescription: draft.operationalDescription.trim(),
  eventTypes: lines(draft.eventTypes),
  operationMode: draft.operationMode,
  operationalNotes: draft.operationalNotes.trim(),
});

export function TenantContextPanel() {
  const { user } = useAuth();
  const developerView = Boolean(
    user?.isDeveloper ||
    user?.role.trim().toLocaleLowerCase('es') === 'administrador',
  );
  const allowed = user?.permissions.includes('empresa_contexto.ver') ?? false;
  const editable =
    user?.permissions.includes('empresa_contexto.editar') ?? false;
  const [context, setContext] = useState<TenantContext>();
  const [draft, setDraft] = useState<Draft>();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [registrationLink, setRegistrationLink] = useState<string>();
  const [registrationBusy, setRegistrationBusy] = useState(false);
  const feedback = useFeedback();

  useEffect(() => {
    if (!allowed || user?.scope !== 'tenant') return;
    let active = true;
    getTenantContext()
      .then((value) => {
        if (active) {
          setContext(value);
          setDraft(toDraft(value));
          setRegistrationLink(undefined);
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
      payload.eventTypes.some((item) => item.length > 80)
    ) {
      feedback.guide(
        'Se permiten hasta 20 tipos de evento de máximo 80 caracteres cada uno.',
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
        'No se realizó ningún cambio. Modifica algún dato antes de actualizar el contexto.',
        'Sin cambios',
        'warning',
      );
      return;
    }
    const confirmed = await feedback.confirm(
      'Actualizar contexto operativo',
      '¿Deseas guardar los cambios en la información de la empresa?',
      'Actualizar información',
      'info',
      'ACTUALIZAR',
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      const latest = await getTenantContext();
      const updated = await updateTenantContext({
        sector: latest.sector ?? null,
        operationalDescription: latest.operationalDescription ?? null,
        eventTypes: latest.eventTypes ?? [],
        operationMode: latest.operationMode ?? null,
        operationalAreas: latest.operationalAreas ?? [],
        operationalNotes: latest.operationalNotes ?? null,
        ...changes,
      });
      setContext(updated);
      setDraft(toDraft(updated));
      setRegistrationLink(undefined);
      setEditing(false);
      feedback.notify('El contexto operativo se actualizó correctamente.');
    } catch (err) {
      feedback.notify(apiErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function copyRegistrationLink() {
    if (registrationBusy) return;
    setRegistrationBusy(true);
    try {
      const link = registrationLink
        ? { url: registrationLink }
        : await getTenantRegistrationLink();
      setRegistrationLink(link.url);
      await navigator.clipboard.writeText(link.url);
      feedback.notify('El enlace de registro se copió al portapapeles.');
    } catch (err) {
      feedback.notify(apiErrorMessage(err), 'error');
    } finally {
      setRegistrationBusy(false);
    }
  }

  async function renewRegistrationLink() {
    if (registrationBusy) return;
    const confirmed = await feedback.confirm(
      'Renovar enlace de registro',
      'El enlace actual dejará de funcionar de inmediato, incluso para registros que aún no se hayan confirmado.',
      'Renovar enlace',
      'warning',
      'RENOVAR',
    );
    if (!confirmed) return;
    setRegistrationBusy(true);
    try {
      const link = await rotateTenantRegistrationLink();
      setRegistrationLink(link.url);
      feedback.notify('Se generó un nuevo enlace de registro.');
    } catch (err) {
      feedback.notify(apiErrorMessage(err), 'error');
    } finally {
      setRegistrationBusy(false);
    }
  }

  if (!allowed) return null;
  return (
    <section className="module-panel" aria-label="Contexto operativo">
      <FeedbackMessages feedback={feedback} />
      <div
        className={`module-panel__heading ${panelHeadingStyles.heading} ${developerView ? styles.header : ''}`}
      >
        <div>
          <h2 className="text-xl font-bold">Contexto operativo</h2>
          <p className="mt-1 text-sm text-muted">
            Describe cómo trabaja tu empresa para orientar la organización de
            sus perfiles.
            {!developerView &&
              ' Esta información no asigna permisos automáticamente.'}
          </p>
        </div>
        {developerView && editable && context && draft && !editing && (
          <Button
            type="button"
            variant="secondary"
            data-tour="tenant-context-edit"
            onClick={() => {
              setDraft(toDraft(context));
              setEditing(true);
            }}
          >
            <span aria-hidden="true">✎</span> Editar contexto
          </Button>
        )}
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
        ) : developerView && !editing ? (
          <div className={styles.summary}>
            <p className={styles.notice}>
              <span aria-hidden="true">ⓘ</span> Esta información no asigna
              permisos automáticamente.
            </p>
            <div className={styles.overview}>
              <div className={styles.fact}>
                <h3>Sector</h3>
                <p>{context.sector || 'Sin especificar'}</p>
              </div>
              <div className={styles.fact}>
                <h3>Modalidad de operación</h3>
                <p>
                  {context.operationMode === 'propios'
                    ? 'Eventos propios'
                    : context.operationMode === 'clientes'
                      ? 'Eventos para clientes'
                      : context.operationMode === 'ambos'
                        ? 'Ambos'
                        : 'Sin especificar'}
                </p>
              </div>
            </div>
            <div
              className={styles.registration}
              data-tour="tenant-registration-card"
            >
              <div className={styles.registrationIntro}>
                <h3>Registro de usuarios por empresa</h3>
                <p>
                  {context.emailDomain
                    ? `Las personas podrán registrarse con un correo @${context.emailDomain}. Comparte el enlace solo con quienes desees invitar.`
                    : 'Configura el dominio corporativo para habilitar el enlace de registro de usuarios.'}
                </p>
              </div>
              {editable && context.emailDomain && (
                <div className={styles.registrationActions}>
                  <Button
                    className={styles.copyButton}
                    type="button"
                    data-tour="tenant-registration-copy"
                    disabled={registrationBusy}
                    onClick={copyRegistrationLink}
                  >
                    {registrationBusy ? 'Preparando enlace…' : 'Copiar enlace'}
                  </Button>
                  <Button
                    className={styles.renewButton}
                    type="button"
                    variant="ghost"
                    data-tour="tenant-registration-renew"
                    disabled={registrationBusy}
                    onClick={renewRegistrationLink}
                  >
                    Renovar enlace
                  </Button>
                </div>
              )}
              {registrationLink && (
                <div className={styles.linkBlock}>
                  <span>Enlace de registro activo</span>
                  <p className={styles.registrationLink}>{registrationLink}</p>
                </div>
              )}
            </div>
            <div className={styles.section}>
              <h3>Descripción de la operación</h3>
              <p>{context.operationalDescription || 'Sin descripción.'}</p>
            </div>
            <div className={styles.section}>
              <h3>Tipos de eventos</h3>
              <div className={styles.tags}>
                {context.eventTypes.length ? (
                  context.eventTypes.map((type) => (
                    <span key={type}>{type}</span>
                  ))
                ) : (
                  <p>Sin tipos registrados.</p>
                )}
              </div>
            </div>
            <div className={`${styles.section} ${styles.notes}`}>
              <h3>Notas operativas</h3>
              <p>{context.operationalNotes || 'Sin notas.'}</p>
            </div>
          </div>
        ) : (
          <form
            onSubmit={save}
            className="grid gap-5"
            data-tour={editing ? 'tenant-context-edit-form' : undefined}
          >
            <fieldset className="grid min-w-0 gap-5 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                Sector
                <input
                  className={inputClass}
                  aria-label="Sector"
                  disabled={!editing || busy}
                  placeholder="Ej. Organización de eventos culturales"
                  maxLength={80}
                  value={draft.sector}
                  onChange={(e) =>
                    setDraft({ ...draft, sector: e.target.value })
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Dominio para registro
                <input
                  className={inputClass}
                  aria-label="Dominio para registro"
                  disabled={!editing || busy}
                  placeholder="empresa.com"
                  maxLength={253}
                  value={draft.emailDomain}
                  onChange={(e) =>
                    setDraft({ ...draft, emailDomain: e.target.value })
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Modalidad de operación
                <select
                  className={inputClass}
                  aria-label="Modalidad de operación"
                  disabled={!editing || busy}
                  value={draft.operationMode ?? ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      operationMode: (e.target.value ||
                        null) as Draft['operationMode'],
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
                  className={inputClass}
                  aria-label="Descripción de la operación"
                  disabled={!editing || busy}
                  placeholder="Ej. Organizamos eventos culturales y coordinamos proveedores y logística."
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
              <EventTypesInput
                key={editing ? 'editando' : 'consultando'}
                value={draft.eventTypes}
                onChange={(eventTypes) => setDraft({ ...draft, eventTypes })}
                readOnly={!editing || busy}
                showEntries={editing}
              />
              <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                Notas operativas
                <textarea
                  className={inputClass}
                  aria-label="Notas operativas"
                  disabled={!editing || busy}
                  placeholder="Ej. Trabajamos con proveedores externos según el evento."
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
                <div
                  className="flex flex-wrap gap-3"
                  data-tour="tenant-context-edit-actions"
                >
                  <Button type="submit" disabled={busy}>
                    {busy ? 'Actualizando…' : 'Actualizar información'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    data-tour="tenant-context-edit-cancel"
                    disabled={busy}
                    onClick={() => {
                      setDraft(toDraft(context));
                      setEditing(false);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : !developerView ? (
                <Button
                  type="button"
                  className="justify-self-start"
                  data-tour="tenant-context-edit"
                  onClick={() => {
                    setDraft(toDraft(context));
                    setEditing(true);
                  }}
                >
                  Editar contexto
                </Button>
              ) : null)}
          </form>
        )}
      </div>
    </section>
  );
}
