'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { defaultRouteFor } from '../../lib/access-control';
import { useAuth } from '../../hooks/useAuth';
import { apiErrorMessage } from '../../services/api';
import { startGoogleLogin } from '../../services/auth.service';
import type { AuthUser } from '../../types/auth';
import { TurnstileWidget } from './TurnstileWidget';

const captchaConfigured = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

export function LoginForm() {
  const router = useRouter();
  const { isLoading, signIn, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAlertVisible, setIsAlertVisible] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successfulLogin, setSuccessfulLogin] = useState<AuthUser | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const captchaSectionRef = useRef<HTMLDivElement>(null);
  const isLoginFlow = useRef(false);

  useEffect(() => {
    const googleResult = new URLSearchParams(window.location.search).get(
      'google',
    );
    queueMicrotask(() => {
      if (googleResult === 'unlinked')
        setError(
          'Esta cuenta de Google aún no está vinculada a Evoria. Entra con tu contraseña y vincúlala desde Mi perfil.',
        );
      else if (googleResult === 'cancelled')
        setError('Cancelaste el inicio de sesión con Google.');
      else if (googleResult === 'error')
        setError('No se pudo iniciar sesión con Google. Intenta de nuevo.');
    });
    if (googleResult) window.history.replaceState(null, '', '/login');
  }, []);

  useEffect(() => {
    if (!isLoading && user && !isLoginFlow.current) {
      router.replace(defaultRouteFor(user.permissions));
    }
  }, [isLoading, router, user]);

  useEffect(() => {
    if (!successfulLogin) return;

    const timeout = window.setTimeout(() => {
      isLoginFlow.current = false;
      router.replace(defaultRouteFor(successfulLogin.permissions));
    }, 2500);

    return () => window.clearTimeout(timeout);
  }, [router, successfulLogin]);

  function requestCaptcha() {
    setError('Completa la verificación de seguridad para continuar.');
    captchaSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    captchaSectionRef.current?.focus({ preventScroll: true });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (captchaConfigured && !captchaToken) {
      requestCaptcha();
      return;
    }
    setError(null);
    setIsSubmitting(true);
    isLoginFlow.current = true;

    try {
      const user = await signIn({
        email,
        password,
        captchaToken: captchaToken ?? undefined,
      });
      setError(null);
      setIsAlertVisible(false);
      setFailedAttempts(0);
      setSuccessfulLogin(user);
    } catch (submitError) {
      setCaptchaResetKey((value) => value + 1);
      isLoginFlow.current = false;
      const nextAttempt = Math.min(failedAttempts + 1, 5);
      const backendMessage =
        submitError instanceof Error ? submitError.message : '';
      const isLocked = backendMessage.toLowerCase().includes('bloqueada');
      const isCaptchaError = /captcha|verificación de seguridad/i.test(
        backendMessage,
      );

      if (!isCaptchaError) setFailedAttempts(nextAttempt);
      setIsAlertVisible(true);
      setError(
        isCaptchaError
          ? apiErrorMessage(submitError)
          : isLocked || nextAttempt >= 5
            ? 'Demasiados intentos fallidos. Por seguridad, el inicio de sesión se ha desactivado por 15 minutos. Si olvidaste tu clave, restablécela aquí.'
            : nextAttempt >= 3
              ? `Contraseña incorrecta. Te quedan ${5 - nextAttempt} intentos antes de que la cuenta se bloquee temporalmente por seguridad.`
              : 'Usuario o contraseña incorrectos.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    if (captchaConfigured && !captchaToken) {
      requestCaptcha();
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      window.location.assign(await startGoogleLogin(captchaToken ?? undefined));
    } catch (cause) {
      setError(apiErrorMessage(cause));
      setCaptchaResetKey((value) => value + 1);
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form className="login-form" onSubmit={handleSubmit}>
        <div className="login-field">
          <label htmlFor="email">Correo electrónico</label>
          <div className="login-input-container">
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <rect
                height="15"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.8"
                width="19"
                x="2.5"
                y="4.5"
              />
              <path
                d="m3.5 6 8.5 7 8.5-7"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
            <input
              autoComplete="username"
              id="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="correo@evoria.com"
              required
              type="email"
              value={email}
            />
          </div>
        </div>

        <div className="login-field">
          <label htmlFor="password">Contraseña</label>
          <div className="login-input-container">
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <rect
                height="11"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.8"
                width="16"
                x="4"
                y="10"
              />
              <path
                d="M8 10V7a4 4 0 0 1 8 0v3"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
            <input
              autoComplete="current-password"
              id="password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Ingresa tu contraseña"
              required
              type={showPassword ? 'text' : 'password'}
              value={password}
            />
            <button
              aria-label={
                showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
              }
              className="login-toggle-password"
              onClick={() => setShowPassword((visible) => !visible)}
              type="button"
            >
              <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                <path
                  d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="2.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-right text-sm text-muted">
            ¿Olvidaste tu contraseña?
          </p>
        </div>

        {error ? (
          <p aria-live="polite" className="login-error" role="alert">
            <span aria-hidden="true">⚠️</span>
            <span>{error}</span>
          </p>
        ) : null}

        <button className="login-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
        </button>
        <div className="flex items-center gap-3 py-5 text-sm text-muted">
          <span aria-hidden="true" className="h-px flex-1 bg-sky-blue" />
          <span>O</span>
          <span aria-hidden="true" className="h-px flex-1 bg-sky-blue" />
        </div>
        <button
          className="inline-flex min-h-[3.125rem] w-full cursor-pointer items-center justify-center gap-2.5 rounded-[0.875rem] border border-[#747775] bg-white px-4 text-base font-semibold text-[#1f1f1f] transition hover:bg-[#f8fafd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a73e8] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          onClick={handleGoogleLogin}
          type="button"
        >
          <Image
            alt=""
            height={18}
            src="https://developers.google.com/static/identity/images/g-logo.png"
            unoptimized
            width={18}
          />
          Continuar con Google
        </button>
        {captchaConfigured ? (
          <div
            aria-label="Verificación de seguridad: complétala antes de ingresar"
            className="mt-6 border-t border-sky-blue pt-4 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            ref={captchaSectionRef}
            role="group"
            tabIndex={-1}
          >
            <TurnstileWidget
              onToken={setCaptchaToken}
              resetKey={captchaResetKey}
            />
          </div>
        ) : null}
      </form>

      {error && isAlertVisible ? (
        <div
          aria-live="assertive"
          className="login-alert-backdrop fixed inset-0 z-50 grid place-items-center p-6"
          role="alertdialog"
          aria-modal="true"
          aria-label="Alerta de inicio de sesión"
        >
          <div className="login-alert-modal">
            <button
              aria-label="Cerrar alerta"
              className="login-alert-close"
              onClick={() => setIsAlertVisible(false)}
              type="button"
            >
              ×
            </button>
            <div className="login-alert-icon" aria-hidden="true">
              ⚠️
            </div>
            <p className="login-alert-kicker">Revisa tus datos</p>
            <p className="login-alert-message">{error}</p>
            <button
              className="login-alert-button"
              onClick={() => setIsAlertVisible(false)}
              type="button"
            >
              Entendido
            </button>
          </div>
        </div>
      ) : null}
      {successfulLogin ? (
        <div
          aria-label="Inicio de sesión exitoso"
          aria-live="polite"
          className="login-alert-backdrop fixed inset-0 z-[1100] grid place-items-center p-6"
          role="status"
        >
          <div className="event-success-modal">
            <div className="event-success-icon" aria-hidden="true">
              ✓
            </div>
            <p className="event-success-title">
              ¡Hola, {successfulLogin.name}!
            </p>
            <p className="event-success-message">
              {successfulLogin.role ? `${successfulLogin.role}. ` : ''}
              Bienvenido/a, inicio de sesión exitoso.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
