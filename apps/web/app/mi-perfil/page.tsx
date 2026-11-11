'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { PageHero } from '../../components/ui/PageHero';
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
    <AppShell hideTitle title="Mi perfil">
      <div className="mx-auto grid max-w-6xl gap-6">
        <PageHero
          description="Consulta tus datos y administra tu inicio de sesión."
          title="Mi perfil"
        />

        <section className="grid gap-10 md:grid-cols-[1.05fr_.95fr] md:gap-12">
          <article className="min-w-0">
            <div className="flex flex-wrap items-center gap-5">
              <span
                aria-hidden="true"
                className="grid size-20 place-items-center rounded-[1.35rem] bg-linear-to-br from-violet to-teal font-display text-3xl font-bold text-white shadow-[0_10px_22px_rgba(106,76,255,0.25)]"
              >
                {user?.name.charAt(0).toUpperCase() ?? 'E'}
              </span>
              <div className="min-w-0">
                <h2 className="break-words text-3xl font-bold text-navy">
                  {user?.name}
                </h2>
                <p className="mt-1 break-all text-muted">{user?.email}</p>
              </div>
            </div>
            <dl className="mt-7 grid border-t border-sky-blue">
              <div className="flex flex-col gap-1 border-b border-sky-blue py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <dt className="text-sm text-muted">Perfil de acceso</dt>
                <dd className="font-semibold text-navy">{user?.role}</dd>
              </div>
              <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <dt className="text-sm text-muted">Empresa activa</dt>
                <dd className="break-words font-semibold text-navy sm:text-right">
                  {user?.tenant?.name ?? 'Sin empresa activa'}
                </dd>
              </div>
            </dl>
          </article>

          <article className="min-w-0 border-t border-sky-blue pt-8 md:border-l md:border-t-0 md:pl-12 md:pt-0">
            <h2 className="text-2xl font-bold">Inicio de sesión</h2>
            <p className="mt-1 text-sm text-muted">
              Administra la cuenta que usas para acceder a Evoria.
            </p>
            <div className="w-full">
              <div className="flex items-start justify-between gap-4">
                <div className="mt-6 flex min-w-0 items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-2xl border border-sky-blue bg-white shadow-sm">
                    <Image
                      alt=""
                      height={23}
                      src="https://developers.google.com/static/identity/images/g-logo.png"
                      unoptimized
                      width={23}
                    />
                  </span>
                  <div>
                    <p className="font-semibold text-navy">Google</p>
                    <p className="mt-1 break-all text-sm text-muted">
                      {connection?.linked
                        ? connection.email
                        : connection
                          ? 'Sin cuenta vinculada'
                          : 'Consultando vinculación…'}
                    </p>
                  </div>
                </div>
                <span
                  className={`mt-6 inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                    connection?.linked
                      ? 'bg-teal/10 text-teal'
                      : 'bg-sky-blue/70 text-muted'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`size-1.5 rounded-full ${
                      connection?.linked ? 'bg-teal' : 'bg-muted'
                    }`}
                  />
                  {connection?.linked ? 'Vinculada' : 'Sin vincular'}
                </span>
              </div>

              <div className="mt-5 border-t border-sky-blue pt-5">
                {connection?.linked ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button disabled type="button">
                      Cambiar cuenta de Google
                    </Button>
                    <span className="rounded-full bg-violet/10 px-3 py-1 text-xs font-semibold text-violet">
                      Próximamente
                    </span>
                  </div>
                ) : (
                  <Button
                    className="inline-flex items-center gap-2.5"
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
                  </Button>
                )}
              </div>

              {notice ? (
                <p
                  className="mt-5 rounded-xl border border-teal/20 bg-teal/10 px-4 py-3 text-sm font-medium text-teal"
                  role="status"
                >
                  {notice}
                </p>
              ) : null}
              {error ? (
                <p
                  className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
            </div>
          </article>
        </section>
      </div>
    </AppShell>
  );
}
