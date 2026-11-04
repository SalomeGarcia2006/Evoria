'use client';
import { useEffect, useState, type FormEvent } from 'react';
import {
  PROVIDER_CATEGORIES,
  type EventProviderService,
  type ProviderCategory,
  type ProviderList,
} from '@evoria/contracts';
import type { EventItem } from '../../services/events.service';
import {
  getProviders,
  createProviderService,
  updateProviderService,
} from '../../services/providers.service';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { ErrorMessage } from '../ui/ErrorMessage';
import { LoadingState } from '../ui/LoadingState';
import { ProviderDialogShell } from './ProviderDialogShell';
import { categoryLabels, inputClass, Field } from './fields';
import { apiErrorMessage, apiFieldErrors } from '../../services/api';
import { FeedbackMessages, useFeedback } from '../ui/Feedback';

function eventDay(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

export function ProviderServiceDialog({
  event,
  service,
  onClose,
  onSaved,
}: {
  event: EventItem;
  service?: EventProviderService;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { can } = useAuth();
  const canSelect = can('proveedores.ver');
  const [values, setValues] = useState({
    providerId: service?.providerId ?? '',
    serviceName: service?.serviceName ?? '',
    description: service?.description ?? '',
    startDate: service?.startDate ?? '',
    startTime: service?.startTime ?? '',
    endDate: service?.endDate ?? '',
    endTime: service?.endTime ?? '',
    amount: service ? String(service.agreedAmountCop) : '',
  });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ProviderCategory | ''>('');
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [providers, setProviders] = useState<{
    key: string;
    data?: ProviderList;
    error?: string;
  }>();
  const [selectedProvider, setSelectedProvider] = useState(service?.provider);
  const [busy, setBusy] = useState(false);
  const feedback = useFeedback();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const key = JSON.stringify([search, category, page, attempt]);
  useEffect(() => {
    if (!canSelect) return;
    let active = true;
    const timer = setTimeout(() => {
      getProviders({
        search,
        category: category || undefined,
        status: 'activo',
        page,
        limit: 20,
      })
        .then((data) => {
          if (active) setProviders({ key, data });
        })
        .catch((err: unknown) => {
          if (active)
            setProviders({
              key,
              error:
                err instanceof Error
                  ? err.message
                  : 'No fue posible cargar los proveedores.',
            });
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [canSelect, key, search, category, page]);
  const providerData = providers?.key === key ? providers.data : undefined;
  const providerError = providers?.key === key ? providers.error : undefined;
  const eventStart = eventDay(event.startAt);
  const eventEnd = eventDay(event.endAt);
  const outside =
    !!values.startDate &&
    (values.startDate < eventStart ||
      values.startDate > eventEnd ||
      (!!values.endDate &&
        (values.endDate < eventStart || values.endDate > eventEnd)));
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || event.status === 'cancelado') return;
    const next: Record<string, string> = {};
    if (!values.providerId) next.providerId = 'Selecciona un proveedor activo.';
    if (values.serviceName.trim().length < 2)
      next.serviceName = 'Escribe un nombre de al menos dos caracteres.';
    if (!values.startDate)
      next.startDate = 'Indica la fecha acordada de prestación.';
    if (values.endTime && !values.endDate)
      next.endDate = 'Indica una fecha de fin para la hora de fin.';
    if (values.endDate && values.endDate < values.startDate)
      next.endDate = 'El fin no puede ser anterior al inicio.';
    if (
      values.endDate === values.startDate &&
      values.startTime &&
      values.endTime &&
      values.endTime < values.startTime
    )
      next.endTime = 'El fin no puede ser anterior al inicio.';
    const amount = Number(values.amount);
    if (
      !/^\d+$/.test(values.amount) ||
      !Number.isSafeInteger(amount) ||
      amount <= 0
    )
      next.amount = 'Ingresa un entero positivo en COP.';
    setErrors(next);
    if (Object.keys(next).length) {
      feedback.guide(
        Object.values(next).join('\n'),
        'Revisa los datos del servicio',
      );
      return;
    }
    setBusy(true);
    feedback.dismiss();
    const body = {
      serviceName: values.serviceName.trim(),
      description: values.description.trim() || null,
      startDate: values.startDate,
      startTime: values.startTime || null,
      endDate: values.endDate || null,
      endTime: values.endTime || null,
      agreedAmountCop: amount,
    };
    try {
      if (service)
        await updateProviderService(event.id, service.id, {
          ...body,
          ...(values.providerId !== service.providerId
            ? { providerId: values.providerId }
            : {}),
        });
      else
        await createProviderService(event.id, {
          ...body,
          providerId: values.providerId,
        });
      onSaved();
    } catch (err) {
      feedback.notify(apiErrorMessage(err), 'error');
      setErrors(
        apiFieldErrors(err, {
          providerId: /providerId|proveedor/i,
          serviceName: /serviceName|nombre del servicio/i,
          startDate: /startDate|fecha.*inicio|fecha.*prestaci/i,
          endDate: /endDate|fecha.*fin/i,
          startTime: /startTime/i,
          endTime: /endTime|hora.*fin/i,
          amount: /agreedAmountCop|costo|saldo|presupuesto disponible/i,
        }),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <ProviderDialogShell
      title={
        service
          ? 'Editar servicio de proveedor'
          : 'Asignar servicio de proveedor'
      }
      busy={busy}
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate className="grid gap-5">
        <FeedbackMessages feedback={feedback} />
        <fieldset disabled={busy} className="grid min-w-0 gap-4">
          {canSelect ? (
            <div className="grid gap-3 rounded-xl border border-sky-blue p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Buscar proveedor"
                  value={search}
                  maxLength={120}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
                <label className="grid gap-2 text-sm font-semibold">
                  Categoría del proveedor
                  <select
                    aria-label="Categoría del proveedor"
                    className={inputClass}
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value as ProviderCategory | '');
                      setPage(1);
                    }}
                  >
                    <option value="">Todas las categorías</option>
                    {PROVIDER_CATEGORIES.map((value) => (
                      <option key={value} value={value}>
                        {categoryLabels[value]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {providerError ? (
                <>
                  <ErrorMessage message={providerError} />
                  <Button
                    type="button"
                    onClick={() => setAttempt((value) => value + 1)}
                  >
                    Reintentar proveedores
                  </Button>
                </>
              ) : !providerData ? (
                <LoadingState label="Cargando proveedores activos…" />
              ) : (
                <>
                  <label className="grid gap-2 text-sm font-semibold">
                    Proveedor
                    <select
                      aria-label="Proveedor"
                      className={inputClass}
                      value={values.providerId}
                      aria-invalid={!!errors.providerId}
                      aria-describedby={
                        errors.providerId
                          ? 'provider-selection-error'
                          : undefined
                      }
                      onChange={(e) => {
                        const id = e.target.value;
                        setValues({ ...values, providerId: id });
                        setSelectedProvider(
                          providerData.items.find((item) => item.id === id) ??
                            service?.provider,
                        );
                      }}
                    >
                      <option value="">Selecciona un proveedor activo</option>
                      {selectedProvider &&
                        !providerData.items.some(
                          (item) => item.id === selectedProvider.id,
                        ) && (
                          <option value={selectedProvider.id}>
                            {selectedProvider.name}
                            {selectedProvider.status === 'inactivo'
                              ? ' · Inactivo (acuerdo histórico)'
                              : ' · Seleccionado'}
                          </option>
                        )}
                      {providerData.items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    {errors.providerId && (
                      <span
                        id="provider-selection-error"
                        className="text-red-700"
                      >
                        {errors.providerId}
                      </span>
                    )}
                  </label>
                  {!providerData.items.length && (
                    <p className="text-sm text-teal">
                      No hay proveedores activos que coincidan con los filtros.
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Proveedores anteriores
                    </Button>
                    <span className="text-sm">
                      Página {page} de{' '}
                      {Math.max(1, providerData.pagination.totalPages)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={page >= providerData.pagination.totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      Más proveedores
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p>
              Proveedor: <strong>{service?.provider.name}</strong> · Sin permiso
              para cambiar el contacto.
            </p>
          )}
          <Field
            label="Nombre del servicio"
            maxLength={120}
            value={values.serviceName}
            error={errors.serviceName}
            onChange={(e) =>
              setValues({ ...values, serviceName: e.target.value })
            }
          />
          <label className="grid gap-2 text-sm font-semibold">
            Descripción
            <textarea
              className={inputClass}
              maxLength={2000}
              value={values.description}
              onChange={(e) =>
                setValues({ ...values, description: e.target.value })
              }
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                {
                  key: 'startDate',
                  label: 'Fecha acordada de prestación',
                  type: 'date',
                },
                {
                  key: 'startTime',
                  label: 'Hora de inicio (opcional)',
                  type: 'time',
                },
                {
                  key: 'endDate',
                  label: 'Fecha de fin (opcional)',
                  type: 'date',
                },
                {
                  key: 'endTime',
                  label: 'Hora de fin (opcional)',
                  type: 'time',
                },
              ] as const
            ).map((field) => (
              <Field
                key={field.key}
                label={field.label}
                type={field.type}
                error={errors[field.key]}
                value={values[field.key]}
                onChange={(e) =>
                  setValues({ ...values, [field.key]: e.target.value })
                }
              />
            ))}
          </div>
          {outside && (
            <p
              role="status"
              className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
            >
              La fecha acordada está fuera del intervalo del evento (
              {eventStart} a {eventEnd}). Puedes guardar si corresponde a
              preparación, montaje o desmontaje.
            </p>
          )}
          <Field
            label="Valor total acordado (COP)"
            inputMode="numeric"
            value={values.amount}
            error={errors.amount}
            onChange={(e) => setValues({ ...values, amount: e.target.value })}
          />
          <p className="text-sm text-teal">
            Registra el acuerdo confirmado con el proveedor. Evoria no consulta
            disponibilidad ni modifica el inventario.
          </p>
          <p className="text-sm text-teal">
            El valor confirmado se registra como gasto del presupuesto. Al
            editarlo, se ajusta el gasto y se valida el saldo disponible.
          </p>
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
            {busy ? 'Guardando…' : 'Guardar servicio'}
          </Button>
        </div>
      </form>
    </ProviderDialogShell>
  );
}
