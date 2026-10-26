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

export default function AsignacionesPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
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
  }, [attempt]);
  const selected = events.find((event) => event.id === selectedId);
  return (
    <AppShell title="Asignación de recursos">
      <div className="grid gap-6">
        <Link
          className="text-sm font-semibold text-teal underline"
          href="/inventario"
        >
          ← Ver inventario
        </Link>
        <h2 className="text-3xl font-bold">Asignar recursos a eventos</h2>
        <Card>
          {loading ? (
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
        {selected ? (
          <EventResources
            editable
            key={selected.id}
            eventId={selected.id}
            cancelled={selected.status === 'cancelado'}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
