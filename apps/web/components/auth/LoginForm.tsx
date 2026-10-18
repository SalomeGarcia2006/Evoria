'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { login } from '../../services/auth.service';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAlertVisible, setIsAlertVisible] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ email, password });
      setError(null);
      setIsAlertVisible(false);
      setFailedAttempts(0);
      router.push('/dashboard');
    } catch (submitError) {
      const nextAttempt = Math.min(failedAttempts + 1, 5);
      const backendMessage =
        submitError instanceof Error ? submitError.message : '';
      const isLocked = backendMessage.toLowerCase().includes('bloqueada');

      setFailedAttempts(nextAttempt);
      setIsAlertVisible(true);
      setError(
        isLocked || nextAttempt >= 5
          ? 'Demasiados intentos fallidos. Por seguridad, el inicio de sesión se ha desactivado por 15 minutos. Si olvidaste tu clave, restablécela aquí.'
          : nextAttempt >= 3
            ? `Contraseña incorrecta. Te quedan ${5 - nextAttempt} intentos antes de que la cuenta se bloquee temporalmente por seguridad.`
            : 'Usuario o contraseña incorrectos.',
      );
    } finally {
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
    </>
  );
}
