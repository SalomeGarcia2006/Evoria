'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { LoadingState } from '../../../components/ui/LoadingState';
import { useAuth } from '../../../hooks/useAuth';
import {
  cancelEvent,
  getEvent,
  type EventItem,
} from '../../../services/events.service';

export default function EventoDetailPage() {
  const params = useParams<{ id: string }>();
  const { can } = useAuth();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

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

  async function handleCancel() {
    if (
      !event ||
      !window.confirm(`¿Deseas cancelar el evento "${event.name}"?`)
    )
      return;
    setIsCancelling(true);
    setError('');
    try {
      setEvent(await cancelEvent(event.id));
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : 'No se pudo cancelar el evento.',
      );
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <AppShell title="Detalle del evento">
      <div className="mx-auto grid max-w-3xl gap-6">
        <Link
          className="text-sm font-semibold text-teal hover:underline"
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
                <p className="text-sm font-semibold uppercase tracking-[.16em] text-teal">
                  {event.type ?? 'Evento'}
                </p>
                <h2 className="mt-2 text-3xl font-bold">{event.name}</h2>
              </div>
              <span className="rounded-full bg-sky-blue px-3 py-1 text-xs font-semibold capitalize text-navy">
                {event.status.replaceAll('_', ' ')}
              </span>
            </div>
            <p className="mt-5 whitespace-pre-wrap text-teal">
              {event.description || 'Sin descripción.'}
            </p>
            <div className="mt-7 grid gap-4 border-t border-sky-blue pt-6 sm:grid-cols-2">
              <div>
                <p className="text-sm text-teal">Inicio</p>
                <p className="mt-1 font-semibold">
                  {new Intl.DateTimeFormat('es-CO', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(event.startAt))}
                </p>
              </div>
              <div>
                <p className="text-sm text-teal">Finalización</p>
                <p className="mt-1 font-semibold">
                  {new Intl.DateTimeFormat('es-CO', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(event.endAt))}
                </p>
              </div>
              <div>
                <p className="text-sm text-teal">Ubicación</p>
                <p className="mt-1 font-semibold">
                  {event.location || 'Sin ubicación'}
                </p>
              </div>
              <div>
                <p className="text-sm text-teal">Tipo</p>
                <p className="mt-1 font-semibold">{event.type || 'Sin tipo'}</p>
              </div>
            </div>
            {can('eventos.eliminar') && event.status !== 'cancelado' ? (
              <div className="mt-6 border-t border-sky-blue pt-5">
                <Button
                  disabled={isCancelling}
                  onClick={() => void handleCancel()}
                >
                  {isCancelling ? 'Cancelando…' : 'Cancelar evento'}
                </Button>
              </div>
            ) : null}
          </Card>
        ) : !error ? (
          <Card>
            <h2 className="text-xl font-bold">Evento no encontrado</h2>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
