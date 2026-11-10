'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../hooks/useAuth';
import { apiErrorMessage } from '../../services/api';
import {
  getGoogleConnection,
  startGoogleLink,
  type GoogleConnection,
} from '../../services/auth.service';

export default function MyProfilePage() {
  const { user } = useAuth();
  const [connection, setConnection] = useState<GoogleConnection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get('google');
    queueMicrotask(() => {
      if (result === 'linked')
        setNotice('Tu cuenta de Google quedó vinculada.');
      else if (result === 'already-used')
        setError(
          'Esta cuenta de Google ya está vinculada a otro usuario o ya tienes otra vinculada.',
        );
      else if (result === 'cancelled')
        setNotice('Cancelaste la vinculación con Google.');
      else if (result === 'error')
        setError('No se pudo vincular la cuenta de Google. Intenta de nuevo.');
    });
    window.history.replaceState(null, '', '/mi-perfil');

    getGoogleConnection()
      .then(setConnection)
      .catch((cause) => {
        setError(apiErrorMessage(cause));
      });
  }, []);

  async function linkGoogle() {
    setError(null);
    setIsLinking(true);
    try {
      window.location.assign(await startGoogleLink());
    } catch (cause) {
      setError(apiErrorMessage(cause));
      setIsLinking(false);
    }
  }

  return (
    <AppShell title="Mi perfil">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-2xl border border-sky-blue bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-5">
            <span
              aria-hidden="true"
              className="grid size-20 place-items-center rounded-full bg-linear-to-br from-teal to-violet text-3xl font-bold text-white"
            >
              {user?.name.charAt(0).toUpperCase() ?? 'E'}
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-navy">{user?.name}</h2>
              <p className="text-muted">{user?.email}</p>
            </div>
          </div>
          <dl className="mt-6 grid gap-4 border-t border-sky-blue pt-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">Perfil de acceso</dt>
              <dd className="font-medium text-navy">{user?.role}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Empresa activa</dt>
              <dd className="font-medium text-navy">
                {user?.tenant?.name ?? 'Sin empresa activa'}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-sky-blue bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-navy">Vinculaciones</h2>
          <p className="mt-1 text-sm text-muted">
            {connection?.linked
              ? 'Tu cuenta de Google está vinculada para iniciar sesión.'
              : 'Vincula Google para poder iniciar sesión con esa cuenta.'}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-sky-blue p-4">
            <div>
              <p className="font-semibold text-navy">Google</p>
              <p className="text-sm text-muted">
                {connection?.linked
                  ? connection.email
                  : connection
                    ? 'Sin vincular'
                    : 'Consultando vinculación…'}
              </p>
              {connection?.linkedAt ? (
                <p className="text-xs text-muted">
                  Vinculada el{' '}
                  {new Date(connection.linkedAt).toLocaleDateString('es-CO')}
                </p>
              ) : null}
            </div>
            {connection?.linked ? (
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <button
                  className="cursor-not-allowed rounded-lg border border-sky-blue bg-beige px-4 py-2 font-medium text-muted"
                  disabled
                  type="button"
                >
                  Cambiar cuenta de Google
                </button>
                <p className="text-xs text-muted">
                  Próximamente: confirmarás el cambio con un código enviado a tu
                  correo vinculado.
                </p>
              </div>
            ) : (
              <button
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-[#747775] bg-white px-4 text-sm font-medium text-[#1f1f1f] shadow-sm transition hover:bg-[#f8fafd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a73e8] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!connection || isLinking}
                onClick={linkGoogle}
                type="button"
              >
                <Image
                  alt=""
                  height={18}
                  src="https://developers.google.com/static/identity/images/g-logo.png"
                  unoptimized
                  width={18}
                />
                {isLinking ? 'Abriendo Google…' : 'Vincular con Google'}
              </button>
            )}
          </div>
          {notice ? (
            <p className="mt-4 text-sm text-teal" role="status">
              {notice}
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
