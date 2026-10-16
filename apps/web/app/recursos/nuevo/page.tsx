'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';

export default function NuevoRecursoPage() {
  const [saved, setSaved] = useState(false);
  return (
    <AppShell title="Nuevo recurso">
      <div className="mx-auto grid max-w-3xl gap-6">
        <div>
          <Link
            className="text-sm font-semibold text-teal hover:underline"
            href="/recursos"
          >
            ← Volver a recursos
          </Link>
          <h2 className="mt-4 text-3xl font-bold">Registrar recurso</h2>
          <p className="mt-1 text-teal">
            Completa la información para organizar el catálogo.
          </p>
        </div>
        <Card>
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Formulario de demostración. No se enviará información: falta
            confirmar el contrato de la API.
          </div>
          {saved ? (
            <p
              className="mb-5 rounded-lg bg-sky-blue/40 p-3 text-sm text-navy"
              role="status"
            >
              Formulario validado. No se guardó información porque la API aún no
              está conectada.
            </p>
          ) : null}
          <form
            className="grid gap-5 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              setSaved(true);
            }}
          >
            <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
              Nombre del recurso
              <input
                className="rounded-lg border border-sky-blue px-3 py-2 font-normal"
                placeholder="Ej. Proyector audiovisual"
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Categoría
              <select
                className="rounded-lg border border-sky-blue bg-white px-3 py-2 font-normal"
                defaultValue=""
              >
                <option disabled value="">
                  Selecciona una categoría
                </option>
                <option>Mobiliario</option>
                <option>Tecnología</option>
                <option>Sonido</option>
                <option>Otro</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Estado
              <select
                className="rounded-lg border border-sky-blue bg-white px-3 py-2 font-normal"
                defaultValue="Disponible"
              >
                <option>Disponible</option>
                <option>En mantenimiento</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Cantidad total
              <input
                className="rounded-lg border border-sky-blue px-3 py-2 font-normal"
                min="0"
                placeholder="0"
                required
                type="number"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Costo unitario
              <input
                className="rounded-lg border border-sky-blue px-3 py-2 font-normal"
                min="0"
                placeholder="0"
                step="0.01"
                type="number"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
              Descripción
              <textarea
                className="rounded-lg border border-sky-blue px-3 py-2 font-normal"
                placeholder="Detalles útiles para identificar el recurso"
                rows={3}
              />
            </label>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <Button type="submit">Validar formulario</Button>
              <Link
                className="inline-flex items-center rounded-lg border border-teal bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-sky-blue"
                href="/recursos"
              >
                Cancelar
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
