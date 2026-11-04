'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { EventResources } from '../../../components/resources/EventResources';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { LoadingState } from '../../../components/ui/LoadingState';
import { getAllEvents, type EventItem } from '../../../services/events.service';
import { useAuth } from '../../../hooks/useAuth';
import { ProviderServices } from '../../../components/providers/ProviderServices';
import { getEventBudget } from '../../../services/presupuestos.service';
import { FeedbackMessages, useFeedback } from '../../../components/ui/Feedback';

export default function AsignacionesPage() {
  const { user } = useAuth();
  return <AssignmentsContent key={`${user?.tenant?.id}:${user?.id}`} />;
}
function AssignmentsContent() {
  const feedback = useFeedback();
  const { notify } = feedback;
  const { can } = useAuth();
  const canSeeEvents = can('eventos.ver');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [budgetRevision, setBudgetRevision] = useState(0);
  const [budgetStatus, setBudgetStatus] = useState<{
    key: string;
    initialized: boolean;
  }>();
  const budgetKey = `${selectedId}:${budgetRevision}`;
  const canViewBudget = can('presupuestos.ver');
  useEffect(() => {
    if (!selectedId || !canViewBudget) return;
    let active = true;
    getEventBudget(selectedId)
      .then((budget) => {
        if (active)
          setBudgetStatus({ key: budgetKey, initialized: budget.initialized });
      })
      .catch(() => {
        if (active) setBudgetStatus({ key: budgetKey, initialized: false });
      });
    return () => {
      active = false;
    };
  }, [selectedId, canViewBudget, budgetKey]);
  const budgetReady =
    !canViewBudget ||
    (budgetStatus?.key === budgetKey && budgetStatus.initialized);
  function budgetChanged() {
    setBudgetRevision((value) => value + 1);
  }
  useEffect(() => {
    if (!canSeeEvents) return;
    let active = true;
    getAllEvents()
      .then((items) => {
        if (active) {
          setEvents(items);
          setError('');
        }
      })
      .catch((error: unknown) => {
        if (active)
          notify(
            error instanceof Error
              ? error.message
              : 'No fue posible cargar los eventos. Intenta de nuevo.',
            'error',
          );
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : 'No fue posible cargar los eventos.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, canSeeEvents, notify]);
  const selected = events.find((event) => event.id === selectedId);
  return (
    <AppShell title="Asignación de recursos">
      <div className="grid gap-6">
        <FeedbackMessages feedback={feedback} />
        {can('inventario.ver') && (
          <Link
            className="text-sm font-semibold text-teal underline"
            href="/inventario"
          >
            ← Ver inventario
          </Link>
        )}
        <h1 className="text-3xl font-bold">Asignaciones para eventos</h1>
        <Card>
          {!canSeeEvents ? (
            <p role="status">
              Necesitas el permiso de consulta de eventos para seleccionar un
              evento y consultar sus asignaciones.
            </p>
          ) : loading ? (
            <LoadingState label="Cargando eventos…" />
          ) : error ? (
            <>
              <ErrorMessage message={error} />
              <Button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setAttempt((value) => value + 1);
                }}
              >
                Reintentar
              </Button>
            </>
          ) : events.length === 0 ? (
            <p className="text-teal">
              No hay eventos registrados. Crea un evento para asignarle
              recursos.
            </p>
          ) : (
            <label className="grid gap-2 text-sm font-semibold">
              Evento
              <select
                aria-label="Evento"
                className="rounded-lg border border-sky-blue bg-white p-3"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                <option value="">Selecciona un evento</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} · {event.status.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
          )}
        </Card>
        <div>
          <Button
            variant="ghost"
            onClick={() =>
              feedback.guide(
                !canSeeEvents
                  ? 'Necesitas permiso de consulta de eventos. Solicítalo al administrador de tu empresa para elegir un evento.'
                  : !events.length
                    ? 'Primero debe existir un evento en tu empresa. Solicita su creación o créalo desde Eventos si tienes el permiso correspondiente.'
                    : !selected
                      ? 'Selecciona un evento en el campo Evento. Después podrás consultar sus reservas y servicios. Para asignar, el evento debe estar activo y tener presupuesto iniciado y saldo suficiente.'
                      : selected.status === 'cancelado'
                        ? 'El evento está cancelado. Puedes consultar el historial, liberar unidades y cancelar acuerdos existentes; no crear nuevas asignaciones ni editar servicios.'
                        : !budgetReady
                          ? 'Revisa el evento desde Presupuestos. Si está sin iniciar, una persona con permiso de edición debe registrar el monto inicial. Después vuelve a esta pantalla y comprueba los requisitos de asignación.'
                          : 'Selecciona un recurso y sus unidades para reservar inventario, o usa Asignar servicio de proveedor para registrar un acuerdo. Cada gasto debe caber en el presupuesto disponible.',
                'Qué necesitas para asignar',
              )
            }
          >
            Qué necesito para asignar
          </Button>
        </div>
        {selected &&
          canViewBudget &&
          !budgetReady &&
          selected.status !== 'cancelado' && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <p className="text-teal">
                Para asignar, el evento debe tener un presupuesto iniciado.
                Puedes revisarlo en Presupuestos.
              </p>
              <Link
                className="font-semibold text-teal underline"
                href={`/presupuestos?eventId=${encodeURIComponent(selected.id)}`}
              >
                Ir a Presupuestos
              </Link>
              <Button variant="secondary" onClick={budgetChanged}>
                Comprobar requisitos de asignación
              </Button>
            </div>
          )}
        {selected && !canViewBudget && (
          <p className="text-sm text-teal">
            Las asignaciones requieren un presupuesto iniciado y saldo
            suficiente. Solicita a una persona con acceso a Presupuestos que
            revise el saldo si no puedes completar la operación.
          </p>
        )}
        {selected && canSeeEvents && can('asignaciones.ver') ? (
          <section aria-label="Reservas de inventario">
            <h2 className="mb-3 text-2xl font-bold">Reservas de inventario</h2>
            <EventResources
              editable
              key={selected.id}
              eventId={selected.id}
              cancelled={selected.status === 'cancelado'}
              budgetReady={budgetReady}
              onChanged={budgetChanged}
            />
          </section>
        ) : null}
        {selected && canSeeEvents && can('servicios_proveedor.ver') && (
          <ProviderServices
            key={selected.id}
            event={selected}
            budgetReady={budgetReady}
            onChanged={budgetChanged}
          />
        )}
        {!selected && can('servicios_proveedor.ver') && (
          <Card>
            <h2 className="text-2xl font-bold">Servicios de proveedores</h2>
            <p className="my-3 text-teal">
              Selecciona un evento para consultar sus acuerdos de servicios.
            </p>
            {can('servicios_proveedor.crear') && can('proveedores.ver') && (
              <Button disabled>Asignar servicio de proveedor</Button>
            )}
          </Card>
        )}
      </div>
    </AppShell>
  );
}
