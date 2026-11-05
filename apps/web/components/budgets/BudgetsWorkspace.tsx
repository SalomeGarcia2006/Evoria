'use client';

import { useEffect, useState } from 'react';
import type { BudgetEventSummary } from '@evoria/contracts';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { isActiveEvent } from '../../services/events.service';
import {
  getAllBudgets,
  getBudgetAuthorizations,
  type BudgetAuthorization,
} from '../../services/presupuestos.service';
import { apiErrorMessage } from '../../services/api';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingState } from '../ui/LoadingState';
import { BudgetEventDialog } from './BudgetEventDialog';
import { cop, requestLabels } from './BudgetAmountsView';
import { FeedbackMessages, useFeedback } from '../ui/Feedback';

const statusLabels: Record<string, string> = {
  borrador: 'Borrador',
  planificado: 'Planificado',
  en_progreso: 'En ejecución',
};

export function BudgetsWorkspace() {
  const { user } = useAuth();
  return <BudgetsWorkspaceContent key={`${user?.tenant?.id}:${user?.id}`} />;
}

function BudgetsWorkspaceContent() {
  const feedback = useFeedback();
  const { notify } = feedback;
  const { user, can } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const eventId = params.get('eventId') ?? '';
  const view =
    params.get('view') === 'authorizations' ? 'authorizations' : 'overview';
  const [revision, setRevision] = useState(0);
  const allowed = can('presupuestos.ver');
  const approve = can('presupuestos.aprobar');
  const [result, setResult] = useState<{
    revision: number;
    items?: BudgetEventSummary[];
    error?: string;
  }>();
  const [inbox, setInbox] = useState<{
    revision: number;
    items?: BudgetAuthorization[];
    error?: string;
  }>();

  useEffect(() => {
    if (!user || !allowed) return;
    let active = true;
    getAllBudgets()
      .then((data) => {
        if (!active) return;
        const events = new Map(
          data.items
            .filter((item) => isActiveEvent(item.eventStatus))
            .map((item) => [item.eventId, item]),
        );
        setResult({ revision, items: [...events.values()] });
      })
      .catch((error: unknown) => {
        if (active) {
          setResult({ revision, error: apiErrorMessage(error) });
          notify(apiErrorMessage(error), 'error');
        }
      });
    return () => {
      active = false;
    };
  }, [user, allowed, revision, notify]);

  useEffect(() => {
    if (!user || !approve) return;
    let active = true;
    getBudgetAuthorizations()
      .then((items) => {
        if (active) setInbox({ revision, items });
      })
      .catch((error: unknown) => {
        if (active) {
          setInbox({ revision, error: apiErrorMessage(error) });
          notify(apiErrorMessage(error), 'error');
        }
      });
    return () => {
      active = false;
    };
  }, [user, approve, revision, notify]);

  const events = result?.revision === revision ? result.items : undefined;
  const error = result?.revision === revision ? result.error : undefined;
  const pending = inbox?.revision === revision ? inbox : undefined;
  function refresh() {
    feedback.dismiss();
    setRevision((value) => value + 1);
  }
  function open(id = '') {
    router.push(
      id ? `/presupuestos?eventId=${encodeURIComponent(id)}` : '/presupuestos',
      { scroll: false },
    );
  }
  function closeBudget() {
    const query = new URLSearchParams(params.toString());
    query.delete('eventId');
    query.delete('history');
    router.replace(`/presupuestos${query.size ? `?${query}` : ''}`, {
      scroll: false,
    });
  }
  function openAuthorizations() {
    const query = new URLSearchParams({ view: 'authorizations' });
    if (eventId) query.set('eventId', eventId);
    router.push(`/presupuestos?${query}`, { scroll: true });
  }

  return (
    <div className="grid min-w-0 gap-6">
      <FeedbackMessages feedback={feedback} />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[.16em] text-teal">
            Planeación financiera
          </p>
          <h1 className="mt-2 text-3xl font-bold">Presupuestos</h1>
          <p className="mt-2 text-teal">
            Controla el presupuesto, los gastos y las solicitudes de cada
            evento.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={refresh}>
            Actualizar
          </Button>
          {approve && view !== 'authorizations' && (
            <Button variant="secondary" onClick={openAuthorizations}>
              Autorizaciones pendientes
              {pending?.items ? ` (${pending.items.length})` : ''}
            </Button>
          )}
        </div>
      </header>

      {view === 'overview' &&
        (allowed ? (
          <section aria-label="Eventos activos" className="grid gap-5">
            <div>
              <h2 className="text-xl font-bold">Eventos activos</h2>
              <p className="mt-2 text-sm text-teal">
                Abre una tarjeta para gestionar el presupuesto de ese evento.
              </p>
            </div>
            {error ? (
              <Card>
                <p className="text-sm text-red-800">{error}</p>
                <Button className="mt-4" variant="secondary" onClick={refresh}>
                  Reintentar eventos
                </Button>
              </Card>
            ) : !events ? (
              <LoadingState label="Cargando eventos activos…" />
            ) : !events.length ? (
              <Card>
                <h3 className="font-bold">Todavía no hay eventos activos</h3>
                <p className="mt-2 text-sm text-teal">
                  Los eventos en borrador, planificados o en ejecución
                  aparecerán aquí cuando estén registrados en tu empresa.
                </p>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {events.map((event) => (
                  <button
                    type="button"
                    key={event.eventId}
                    aria-label={`Ver presupuesto de ${event.eventName}`}
                    aria-haspopup="dialog"
                    aria-expanded={eventId === event.eventId}
                    onClick={() => open(event.eventId)}
                    className="flex h-full min-w-0 flex-col items-start rounded-2xl border border-sky-blue bg-white p-4 text-left shadow-sm transition hover:border-teal hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
                  >
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="rounded-full bg-teal/10 px-3 py-1 text-xs font-semibold text-teal">
                        Activo
                      </span>
                      <span className="text-xs text-teal">
                        {statusLabels[event.eventStatus]}
                      </span>
                    </div>
                    <h3
                      title={event.eventName}
                      className="mt-3 line-clamp-2 break-words text-base font-bold"
                    >
                      {event.eventName}
                    </h3>
                    <p className="mt-1.5 text-xs text-teal">
                      {event.initialized
                        ? 'Saldo, gastos y solicitudes'
                        : 'Presupuesto inicial pendiente'}
                    </p>
                    <span className="mt-3 text-sm font-semibold text-teal">
                      Ver presupuesto →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <p>No tienes permiso para consultar presupuestos.</p>
        ))}

      {eventId && allowed && (
        <BudgetEventDialog
          key={eventId}
          eventId={eventId}
          revision={revision}
          onChanged={refresh}
          onClose={closeBudget}
        />
      )}
      {view === 'overview' && eventId && !allowed && (
        <Card>
          <p>
            Necesitas permiso de consulta de presupuestos para ver el detalle
            financiero del evento.
          </p>
        </Card>
      )}
      {view === 'authorizations' && !approve && (
        <Card>
          <h2 className="text-xl font-bold">
            Necesitas permiso para revisar autorizaciones
          </h2>
          <p className="mt-2 text-sm text-teal">
            Solicita al administrador de tu empresa el acceso correspondiente.
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => open(eventId)}
          >
            Volver a presupuestos
          </Button>
        </Card>
      )}

      {view === 'authorizations' && approve && (
        <section
          className="grid gap-5"
          aria-label="Autorizaciones de presupuesto"
        >
          <div>
            <Button variant="ghost" onClick={() => open(eventId)}>
              {eventId
                ? '← Volver al presupuesto'
                : '← Volver a eventos activos'}
            </Button>
          </div>
          <Card>
            <h2 className="text-xl font-bold">Autorizaciones pendientes</h2>
            <p className="my-3 text-sm text-teal">
              Solicitudes de los eventos que lideras, enviadas por otra persona.
              Revisa el presupuesto actual antes de decidir.
            </p>
            {!allowed && (
              <p className="my-3 text-sm text-amber-900">
                Necesitas permiso para consultar el presupuesto antes de
                decidir.
              </p>
            )}
            {pending?.error ? (
              <p className="text-sm text-red-800">{pending.error}</p>
            ) : !pending?.items ? (
              <LoadingState label="Cargando autorizaciones…" />
            ) : !pending.items.length ? (
              <p className="py-4 text-teal">
                No tienes autorizaciones pendientes.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {pending.items.map((request) => (
                  <article
                    className="rounded-xl border border-sky-blue p-4"
                    key={request.id}
                  >
                    <h3 className="font-semibold">{request.eventName}</h3>
                    <p className="mt-2">
                      {requestLabels[request.type]} · {cop(request.amountCop)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-teal">
                      {request.reason}
                    </p>
                    <p className="mt-2 text-xs text-amber-900">
                      Pendiente · todavía no altera el saldo
                    </p>
                    <Button
                      className="mt-4"
                      disabled={!allowed}
                      onClick={() => open(request.eventId)}
                    >
                      Revisar presupuesto y decidir
                    </Button>
                  </article>
                ))}
              </div>
            )}
          </Card>
        </section>
      )}
    </div>
  );
}
