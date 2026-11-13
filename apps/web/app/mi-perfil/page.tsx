'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ModuleBanner } from '../../components/ui/ModuleBanner';
import { PageHero } from '../../components/ui/PageHero';
import { useAuth } from '../../hooks/useAuth';
import { apiErrorMessage } from '../../services/api';
import {
  confirmGoogleChange,
  getGoogleConnection,
  requestGoogleChange,
  startGoogleLink,
  type GoogleConnection,
} from '../../services/auth.service';

export default function MyProfilePage() {
  const { user } = useAuth();
  const [connection, setConnection] = useState<GoogleConnection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [codeRequested, setCodeRequested] = useState(false);
  const [code, setCode] = useState<string[]>(Array(6).fill(''));
  const codeInputs = useRef<(HTMLInputElement | null)[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get('google');
    queueMicrotask(() => {
      if (result === 'linked') {
        setNotice('Tu cuenta de Google quedó vinculada.');
      } else if (result === 'changed') {
        setNotice('Tu cuenta de Google vinculada se cambió correctamente.');
      } else if (result === 'already-used') {
        setError(
          'Esta cuenta de Google ya está vinculada a otro usuario o ya tienes otra vinculada.',
        );
      } else if (result === 'cancelled') {
        setNotice('Cancelaste la operación con Google.');
      } else if (result === 'error') {
        setError(
          'No se pudo completar la operación con Google. Intenta de nuevo.',
        );
      }
    });
    window.history.replaceState(null, '', '/mi-perfil');

    getGoogleConnection()
      .then(setConnection)
      .catch((cause) => setError(apiErrorMessage(cause)));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function fillCode(index: number, value: string) {
    const characters = value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6 - index);
    setCode((current) => {
      const next = [...current];
      if (!characters) next[index] = '';
      for (let offset = 0; offset < characters.length; offset++) {
        next[index + offset] = characters[offset];
      }
      return next;
    });
    if (characters) {
      codeInputs.current[Math.min(index + characters.length, 5)]?.focus();
    }
  }

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

  async function requestChangeCode() {
    setError(null);
    setNotice(null);
    setIsChanging(true);
    try {
      await requestGoogleChange();
      setCodeRequested(true);
      setCode(Array(6).fill(''));
      setNotice(
        'Te enviamos un código al correo de Google vinculado. Caduca en 10 minutos.',
      );
    } catch (cause) {
      setError(apiErrorMessage(cause));
    } finally {
      setIsChanging(false);
    }
  }

  async function confirmChangeCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsChanging(true);
    try {
      window.location.assign(await confirmGoogleChange(code.join('')));
    } catch (cause) {
      setError(apiErrorMessage(cause));
      setIsChanging(false);
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
                <Button
                  disabled={isChanging}
                  onClick={requestChangeCode}
                  type="button"
                >
                  {isChanging
                    ? 'Enviando código…'
                    : codeRequested
                      ? 'Reenviar código'
                      : 'Cambiar cuenta de Google'}
                </Button>
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

            {connection?.linked && codeRequested ? (
              <form
                className="mt-5 flex flex-col items-start gap-3"
                onSubmit={confirmChangeCode}
              >
                <fieldset className="min-w-0">
                  <legend className="mb-2 text-sm font-medium text-navy">
                    Código recibido en {connection.email}
                  </legend>
                  <div className="flex gap-2">
                    {code.map((character, index) => (
                      <input
                        key={index}
                        ref={(element) => {
                          codeInputs.current[index] = element;
                        }}
                        aria-label={`Carácter ${index + 1} de 6`}
                        autoComplete={index === 0 ? 'one-time-code' : 'off'}
                        className="google-change-code-input h-12 w-10 border-0 border-b-2 bg-transparent text-center text-xl font-semibold text-navy uppercase focus-visible:outline-none"
                        maxLength={1}
                        onChange={(event) =>
                          fillCode(index, event.target.value)
                        }
                        onFocus={(event) => event.target.select()}
                        onKeyDown={(event) => {
                          if (
                            event.key === 'Backspace' &&
                            !character &&
                            index > 0
                          ) {
                            fillCode(index - 1, '');
                            codeInputs.current[index - 1]?.focus();
                          }
                        }}
                        onPaste={(event) => {
                          event.preventDefault();
                          fillCode(index, event.clipboardData.getData('text'));
                        }}
                        pattern="[A-Z0-9]"
                        required
                        value={character}
                      />
                    ))}
                  </div>
                </fieldset>
                <Button
                  disabled={isChanging || code.some((character) => !character)}
                  type="submit"
                >
                  {isChanging ? 'Verificando…' : 'Verificar y cambiar cuenta'}
                </Button>
              </form>
            ) : null}

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
