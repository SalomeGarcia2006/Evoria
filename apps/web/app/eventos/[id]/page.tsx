'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { EventLocation } from '../../../components/events/EventLocation';
import { Card } from '../../../components/ui/Card';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { LoadingState } from '../../../components/ui/LoadingState';
import { useAuth } from '../../../hooks/useAuth';
import { EventResources } from '../../../components/resources/EventResources';
import { getEvent, type EventItem } from '../../../services/events.service';

export default function EventoDetailPage() {
  const params = useParams<{ id: string }>();
  const { can } = useAuth();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getEvent(params.id)
      .then((item) => {
        if (active) setEvent(item);
      })
      .catch((loadError: unknown) => {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'No se pudo cargar el evento.',
          );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params.id]);

  return (
    <AppShell title="Detalle del evento">
      <div className="mx-auto grid max-w-3xl gap-6">
        <Link
          className="text-sm font-semibold text-muted hover:underline"
          href="/eventos"
        >
          ← Volver a eventos
        </Link>
        {error ? <ErrorMessage message={error} /> : null}
        {isLoading ? (
          <LoadingState label="Cargando evento…" />
        ) : event ? (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[.16em] text-muted">
                  {event.type ?? 'Evento'}
                </p>
                <h2 className="mt-2 text-3xl font-bold">{event.name}</h2>
              </div>
              <span className="rounded-full bg-sky-blue px-3 py-1 text-xs font-semibold capitalize text-navy">
                {event.status.replaceAll('_', ' ')}
              </span>
            </div>
            <p className="mt-5 whitespace-pre-wrap text-muted">
              {event.description || 'Sin descripción.'}
            </p>
            <div className="mt-7 grid gap-4 border-t border-sky-blue pt-6 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted">Inicio</p>
                <p className="mt-1 font-semibold">
                  {new Intl.DateTimeFormat('es-CO', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(event.startAt))}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted">Finalización</p>
                <p className="mt-1 font-semibold">
                  {new Intl.DateTimeFormat('es-CO', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(event.endAt))}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted">Ubicación</p>
                <p className="mt-1 font-semibold">
                  <EventLocation value={event.location} />
                </p>
              </div>
              <div>
                <p className="text-sm text-muted">Tipo</p>
                <p className="mt-1 font-semibold">{event.type || 'Sin tipo'}</p>
              </div>
            </div>
          </Card>
        ) : !error ? (
          <Card>
            <h2 className="text-xl font-bold">Evento no encontrado</h2>
          </Card>
        ) : null}
        {event && !isLoading && can('asignaciones.ver') ? (
          <EventResources
            key={event.id}
            eventId={event.id}
            cancelled={event.status === 'cancelado'}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
