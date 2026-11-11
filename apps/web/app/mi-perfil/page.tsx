'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ModuleBanner } from '../../components/ui/ModuleBanner';
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
      if (result === 'linked') {
        setNotice('Tu cuenta de Google quedó vinculada.');
      } else if (result === 'already-used') {
        setError(
          'Esta cuenta de Google ya está vinculada a otro usuario o ya tienes otra vinculada.',
        );
      } else if (result === 'cancelled') {
        setNotice('Cancelaste la vinculación con Google.');
      } else if (result === 'error') {
        setError('No se pudo vincular la cuenta de Google. Intenta de nuevo.');
      }
    });
    window.history.replaceState(null, '', '/mi-perfil');

    getGoogleConnection()
      .then(setConnection)
      .catch((cause) => setError(apiErrorMessage(cause)));
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
      <div className="mx-auto grid max-w-6xl gap-5">
        <PageHero
          description="Consulta la información de tu cuenta y administra cómo inicias sesión."
          title="Mi perfil"
        />

        <ModuleBanner
          description="Mantén tus datos de acceso y tus vinculaciones en un solo lugar."
          icon="perfil.svg"
          title="Tu cuenta, siempre bajo control"
        />

        <section className="grid gap-5 lg:grid-cols-2">
          <Card className="overflow-hidden p-5 sm:p-6">
            <div className="relative overflow-hidden rounded-[1.2rem] bg-linear-to-br from-violet via-violet to-teal p-5 text-white">
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(circle_at_12%_90%,rgba(155,135,255,.72),transparent_35%),radial-gradient(circle_at_92%_72%,rgba(91,224,210,.46),transparent_34%)]"
              />
              <div className="relative flex min-w-0 items-center gap-4">
                <span className="grid size-16 shrink-0 place-items-center rounded-[1rem] border border-white/35 bg-white/15 font-display text-2xl font-bold">
                  {user?.name.charAt(0).toUpperCase() ?? 'E'}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[.16em] text-white/75">
                    Cuenta activa
                  </p>
                  <h2 className="mt-1 break-words text-2xl font-bold">
                    {user?.name}
                  </h2>
                  <p className="mt-1 break-all text-sm text-white/85">
                    {user?.email}
                  </p>
                </div>
              </div>
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="min-w-0 rounded-[1rem] border border-sky-blue bg-beige/50 p-3.5">
                <dt className="text-xs font-semibold uppercase tracking-[.12em] text-muted">
                  Perfil de acceso
                </dt>
                <dd className="mt-2 break-words font-semibold text-navy">
                  {user?.role}
                </dd>
              </div>
              <div className="min-w-0 rounded-[1rem] border border-sky-blue bg-beige/50 p-3.5">
                <dt className="text-xs font-semibold uppercase tracking-[.12em] text-muted">
                  Empresa activa
                </dt>
                <dd className="mt-2 break-words font-semibold text-navy">
                  {user?.tenant?.name ?? 'Sin empresa activa'}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-sky-blue bg-white shadow-sm">
                  <Image
                    alt=""
                    height={24}
                    src="https://developers.google.com/static/identity/images/g-logo.png"
                    unoptimized
                    width={24}
                  />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[.16em] text-muted">
                    Vinculación
                  </p>
                  <h2 className="mt-1 text-2xl font-bold">Google</h2>
                </div>
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
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

            <div className="mt-5 rounded-[1rem] border border-sky-blue bg-beige/50 p-4">
              <p className="break-all text-sm font-medium text-navy">
                {connection?.linked
                  ? connection.email
                  : connection
                    ? 'Sin cuenta vinculada'
                    : 'Consultando vinculación…'}
              </p>
              <p className="mt-2 text-sm text-muted">
                {connection?.linked
                  ? 'Puedes iniciar sesión con esta cuenta de Google.'
                  : 'Vincula una cuenta para usarla al iniciar sesión.'}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {connection?.linked ? (
                <>
                  <Button disabled type="button">
                    Cambiar cuenta de Google
                  </Button>
                  <span className="rounded-full bg-violet/10 px-3 py-1 text-xs font-semibold text-violet">
                    Próximamente
                  </span>
                </>
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
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
