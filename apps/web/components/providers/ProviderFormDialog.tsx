'use client';
import { useState, type FormEvent } from 'react';
import {
  PROVIDER_CATEGORIES,
  type Provider,
  type ProviderCategory,
} from '@evoria/contracts';
import {
  createProvider,
  getProviders,
  updateProvider,
} from '../../services/providers.service';
import { Button } from '../ui/Button';
import { ErrorMessage } from '../ui/ErrorMessage';
import { ProviderDialogShell } from './ProviderDialogShell';
import { categoryLabels, Field, inputClass } from './fields';
import { apiErrorMessage } from '../../services/api';
import { FeedbackMessages, useFeedback } from '../ui/Feedback';

export function ProviderFormDialog({
  provider,
  onClose,
  onSaved,
}: {
  provider?: Provider;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState({
    name: provider?.name ?? '',
    contactName: provider?.contactName ?? '',
    phone: provider?.phone ?? '',
    email: provider?.email ?? '',
    location: provider?.location ?? '',
    notes: provider?.notes ?? '',
  });
  const [categories, setCategories] = useState<ProviderCategory[]>(
    provider?.categoryKeys ?? [],
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const feedback = useFeedback();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const next: Record<string, string> = {};
    if (values.name.trim().length < 2)
      next.name = 'Escribe un nombre de al menos dos caracteres.';
    if (!categories.length)
      next.categories = 'Selecciona al menos una categoría.';
    if (!provider && !values.phone.trim())
      next.phone = 'Ingresa el teléfono del proveedor.';
    if (!provider && !values.email.trim())
      next.email = 'Ingresa el correo del proveedor.';
    if (!provider && !values.location.trim())
      next.location = 'Ingresa la ubicación del proveedor.';
    if (!provider && !values.notes.trim())
      next.notes = 'Ingresa las notas del proveedor.';
    if (provider && !values.phone.trim() && !values.email.trim())
      next.phone = 'Ingresa teléfono o correo.';
    if (
      values.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
    )
      next.email = 'Ingresa un correo válido.';
    if (Object.keys(next).length) {
      feedback.guide(
        [...new Set(Object.values(next))].join('\n'),
        'Revisa los datos del proveedor',
        'error',
      );
      return;
    }
    const body = {
      name: values.name.trim(),
      categoryKeys: categories,
      contactName: values.contactName.trim() || null,
      phone: values.phone.trim() || null,
      email: values.email.trim().toLowerCase() || null,
      location: values.location.trim() || null,
      notes: values.notes.trim() || null,
    };
    if (
      provider &&
      body.name === provider.name.trim() &&
      body.contactName === (provider.contactName?.trim() || null) &&
      body.phone === (provider.phone?.trim() || null) &&
      body.email === (provider.email?.trim().toLowerCase() || null) &&
      body.location === (provider.location?.trim() || null) &&
      body.notes === (provider.notes?.trim() || null) &&
      body.categoryKeys.length === provider.categoryKeys.length &&
      body.categoryKeys.every((category) =>
        provider.categoryKeys.includes(category),
      )
    ) {
      feedback.guide(
        'Modifica algún dato antes de guardar el proveedor.',
        'Revisa los datos del proveedor',
        'error',
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (provider) await updateProvider(provider.id, body);
      else {
        let page = 1;
        let duplicate = false;
        let totalPages = 1;
        while (page <= totalPages && !duplicate) {
          const result = await getProviders({
            search: body.name,
            page,
            limit: 100,
          });
          duplicate = result.items.some(
            (item) =>
              item.name.trim().toLocaleLowerCase() ===
              body.name.toLocaleLowerCase(),
          );
          totalPages = result.pagination.totalPages;
          page += 1;
        }
        if (duplicate) {
          const confirmed = await feedback.confirm(
            'Posible proveedor duplicado',
            'Ya existe un proveedor con este nombre. Revisa sus datos antes de continuar.',
            'Crear de todos modos',
          );
          if (!confirmed) return;
        }
        await createProvider(body);
      }
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  const labels = {
    name: 'Nombre',
    contactName: 'Persona de contacto',
    phone: 'Teléfono',
    email: 'Correo',
    location: 'Ubicación',
  } as const;
  return (
    <ProviderDialogShell
      title={provider ? 'Editar proveedor' : 'Crear proveedor'}
      busy={busy}
      onClose={onClose}
    >
      <form noValidate onSubmit={submit} className="grid gap-5">
        <FeedbackMessages feedback={feedback} />
        {error && <ErrorMessage message={error} />}
        <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
          {Object.entries(labels).map(([key, label]) => (
            <Field
              key={key}
              label={label}
              required={
                key === 'name' ||
                (!provider &&
                  (key === 'phone' || key === 'email' || key === 'location'))
              }
              value={values[key as keyof typeof values]}
              maxLength={
                key === 'email'
                  ? 254
                  : key === 'phone'
                    ? 40
                    : key === 'location'
                      ? 255
                      : 120
              }
              type={
                key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'
              }
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            />
          ))}
          <fieldset className="grid gap-2 sm:col-span-2">
            <legend className="mb-2 text-sm font-semibold">Categorías</legend>
            <div className="flex flex-wrap gap-4">
              {PROVIDER_CATEGORIES.map((category) => (
                <label
                  key={category}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={categories.includes(category)}
                    onChange={(e) =>
                      setCategories(
                        e.target.checked
                          ? [...categories, category]
                          : categories.filter((value) => value !== category),
                      )
                    }
                  />
                  {categoryLabels[category]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
            Notas
            <textarea
              className={inputClass}
              maxLength={1000}
              required={!provider}
              value={values.notes}
              onChange={(e) => setValues({ ...values, notes: e.target.value })}
            />
          </label>
        </fieldset>
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button disabled={busy}>
            {busy
              ? provider
                ? 'Actualizando…'
                : 'Guardando…'
              : provider
                ? 'Actualizar información'
                : 'Guardar proveedor'}
          </Button>
        </div>
      </form>
    </ProviderDialogShell>
  );
}
