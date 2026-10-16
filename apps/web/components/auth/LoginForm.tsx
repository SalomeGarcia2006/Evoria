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
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ email, password });
      router.push('/dashboard');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No fue posible iniciar sesión.',
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
          <p
            aria-live="polite"
            className="mb-4 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <button className="login-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
        </button>
      </form>
    </>
  );
}
