'use client';
import cardStyles from '../ui/InventoryStyleCard.module.css';

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
import { PageHero } from '../ui/PageHero';
import { ModuleBanner } from '../ui/ModuleBanner';
import panelHeadingStyles from '../ui/PanelHeading.module.css';
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
          setResult((previous) => ({
            revision,
            items: previous?.items,
            error: apiErrorMessage(error),
          }));
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
          setInbox((previous) => ({
            revision,
            items: previous?.items,
            error: apiErrorMessage(error),
          }));
          notify(apiErrorMessage(error), 'error');
        }
      });
    return () => {
      active = false;
    };
  }, [user, approve, revision, notify]);

  const events = result?.items;
  const error = result?.revision === revision ? result.error : undefined;
  const pending = inbox;
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
      <PageHero
        title="Presupuestos"
        description="Controla el presupuesto, los gastos y las solicitudes de cada evento."
        actions={
          <>
            <Button variant="secondary" onClick={refresh}>
              Actualizar
            </Button>
            {approve && view !== 'authorizations' && (
              <Button variant="secondary" onClick={openAuthorizations}>
                Autorizaciones pendientes
                {pending?.items ? ` (${pending.items.length})` : ''}
              </Button>
            )}
          </>
        }
      />
      <ModuleBanner
        icon="presupuesto.svg"
        title="Seguimiento financiero"
        description="Consulta los saldos y revisa las solicitudes de presupuesto de cada evento."
      />

      {view === 'overview' &&
        (allowed ? (
          <section aria-label="Eventos activos" className="module-panel">
            <div
              className={`module-panel__heading ${panelHeadingStyles.heading}`}
            >
              <h2 className="text-xl font-bold">Eventos activos</h2>
              <p className="mt-2 text-sm text-muted">
                Abre una tarjeta para gestionar el presupuesto de ese evento.
              </p>
            </div>
            <div className="module-panel__content grid gap-5">
              {error && events && (
                <Card>
                  <p className="text-sm text-red-800">{error}</p>
                  <Button
                    className="mt-4"
                    variant="secondary"
                    onClick={refresh}
                  >
                    Reintentar eventos
                  </Button>
                </Card>
              )}
              {error && !events ? (
                <Card>
                  <p className="text-sm text-red-800">{error}</p>
                  <Button
                    className="mt-4"
                    variant="secondary"
                    onClick={refresh}
                  >
                    Reintentar eventos
                  </Button>
                </Card>
              ) : !events ? (
                <LoadingState label="Cargando eventos activos…" />
              ) : !events.length ? (
                <Card>
                  <h3 className="font-bold">Todavía no hay eventos activos</h3>
                  <p className="mt-2 text-sm text-muted">
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
                      className={`${cardStyles.card} ${cardStyles.interactive} flex h-full flex-col items-start text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal`}
                    >
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className="rounded-full bg-teal/10 px-3 py-1 text-xs font-semibold text-muted">
                          Activo
                        </span>
                        <span className="text-xs text-muted">
                          {statusLabels[event.eventStatus]}
                        </span>
                      </div>
                      <h3
                        title={event.eventName}
                        className="mt-5 line-clamp-2 break-words text-2xl font-bold leading-tight"
                      >
                        {event.eventName}
                      </h3>
                      <p className="mt-1.5 text-xs text-muted">
                        {event.initialized
                          ? 'Saldo, gastos y solicitudes'
                          : 'Presupuesto inicial pendiente'}
                      </p>
                      <span className="mt-auto w-full border-t border-violet/20 pt-4 text-right text-base font-semibold text-violet">
                        Ver presupuesto →
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
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
          <p className="mt-2 text-sm text-muted">
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
            <p className="my-3 text-sm text-muted">
              Solicitudes de los eventos que lideras, enviadas por otra persona.
              Revisa el presupuesto actual antes de decidir.
            </p>
            {!allowed && (
              <p className="my-3 text-sm text-amber-900">
                Necesitas permiso para consultar el presupuesto antes de
                decidir.
              </p>
            )}
            {pending?.error && (
              <p className="text-sm text-red-800">{pending.error}</p>
            )}
            {pending?.error && !pending.items ? null : !pending?.items ? (
              <LoadingState label="Cargando autorizaciones…" />
            ) : !pending.items.length ? (
              <p className="py-4 text-muted">
                No tienes autorizaciones pendientes.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {pending.items.map((request) => (
                  <article className={cardStyles.card} key={request.id}>
                    <h3 className="font-semibold">{request.eventName}</h3>
                    <p className="mt-2">
                      {requestLabels[request.type]} · {cop(request.amountCop)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">
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
