'use client';
import { useState, type FormEvent } from 'react';
import {
  PROVIDER_CATEGORIES,
  type Provider,
  type ProviderCategory,
} from '@evoria/contracts';
import {
  createProvider,
  updateProvider,
} from '../../services/providers.service';
import { Button } from '../ui/Button';
import { ErrorMessage } from '../ui/ErrorMessage';
import { ProviderDialogShell } from './ProviderDialogShell';
import { categoryLabels, Field, inputClass } from './fields';
import { apiErrorMessage, apiFieldErrors } from '../../services/api';

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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const next: Record<string, string> = {};
    if (values.name.trim().length < 2)
      next.name = 'Escribe un nombre de al menos dos caracteres.';
    if (!categories.length)
      next.categories = 'Selecciona al menos una categoría.';
    if (!values.phone.trim() && !values.email.trim())
      next.phone = next.email = 'Ingresa teléfono o correo.';
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
      next.email = 'Ingresa un correo válido.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError('');
    const body = {
      name: values.name.trim(),
      categoryKeys: categories,
      contactName: values.contactName.trim() || null,
      phone: values.phone.trim() || null,
      email: values.email.trim() || null,
      location: values.location.trim() || null,
      notes: values.notes.trim() || null,
    };
    try {
      if (provider) await updateProvider(provider.id, body);
      else await createProvider(body);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
      setErrors(
        apiFieldErrors(err, {
          name: /\bname\b|nombre/i,
          categories: /categoryKeys|categor/i,
          phone: /phone|teléfono/i,
          email: /email|correo/i,
          contactName: /contactName/i,
          location: /location|ubicaci/i,
        }),
      );
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
        {error && <ErrorMessage message={error} />}
        <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
          {Object.entries(labels).map(([key, label]) => (
            <Field
              key={key}
              label={label}
              error={errors[key]}
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
            {errors.categories && (
              <p className="text-sm text-red-700">{errors.categories}</p>
            )}
          </fieldset>
          <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
            Notas
            <textarea
              className={inputClass}
              maxLength={1000}
              value={values.notes}
              onChange={(e) => setValues({ ...values, notes: e.target.value })}
            />
          </label>
        </fieldset>
        <p className="text-sm text-muted">
          Nombre, categorías y al menos un teléfono o correo son obligatorios.
        </p>
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
            {busy ? 'Guardando…' : 'Guardar proveedor'}
          </Button>
        </div>
      </form>
    </ProviderDialogShell>
  );
}
