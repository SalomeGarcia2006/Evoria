'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { apiErrorMessage } from '../../services/api';
import { confirmPasswordReset } from '../../services/auth.service';

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,128}$/;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const validPassword = passwordPattern.test(password);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation)
      return setError('Las contraseñas no coinciden.');
    if (!validPassword)
      return setError(
        'Usa 8 caracteres, minúscula, mayúscula, número y carácter especial.',
      );
    setError(null);
    setLoading(true);
    try {
      const email = sessionStorage.getItem('passwordResetEmail');
      const code = sessionStorage.getItem('passwordResetCode');
      if (!email || !code) {
        router.replace('/recuperar-contrasena');
        return;
      }
      await confirmPasswordReset(email, code, password);
      sessionStorage.removeItem('passwordResetEmail');
      sessionStorage.removeItem('passwordResetCode');
      setDone(true);
      window.setTimeout(() => router.replace('/login'), 1800);
    } catch (cause) {
      setError(apiErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-container">
        <header className="login-brand">
          <div className="login-brand-logo">
            <Image
              alt="Logo de EVORIA"
              height={90}
              src="/images/logoevoria.png"
              width={90}
            />
          </div>
          <div>
            <h1>EVORIA</h1>
            <p>Establece una nueva contraseña</p>
          </div>
        </header>
        <section className="login-card recovery-card">
          <form className="login-form" onSubmit={submit}>
            <div className="login-field">
              <label htmlFor="reset-password">Nueva contraseña</label>
              <div className="login-input-container">
                <input
                  id="reset-password"
                  minLength={8}
                  onChange={(event) => setPassword(event.target.value)}
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
            <div className="login-field">
              <label htmlFor="reset-confirmation">Repite la contraseña</label>
              <div className="login-input-container">
                <input
                  id="reset-confirmation"
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                  type={showConfirmation ? 'text' : 'password'}
                  value={confirmation}
                />
                <button
                  aria-label={
                    showConfirmation
                      ? 'Ocultar confirmación de contraseña'
                      : 'Mostrar confirmación de contraseña'
                  }
                  className="login-toggle-password"
                  onClick={() => setShowConfirmation((visible) => !visible)}
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
            <p className="text-sm text-muted">
              Mínimo 8 caracteres, con mayúscula, minúscula, número y carácter
              especial.
            </p>
            {error ? (
              <p className="login-error" role="alert">
                {error}
              </p>
            ) : null}
            <button
              className="login-button"
              disabled={loading || done}
              type="submit"
            >
              {loading ? 'Actualizando…' : 'Actualizar contraseña'}
            </button>
            <div className="recovery-card__links">
              <a className="recovery-card__back" href="/verificar-contrasena">
                ← Volver a verificar el código
              </a>
              <a className="recovery-card__back" href="/login">
                Volver al inicio de sesión
              </a>
            </div>
          </form>
        </section>
      </div>
      {done ? (
        <div
          aria-label="Contraseña actualizada correctamente"
          aria-live="polite"
          className="login-alert-backdrop fixed inset-0 z-[1100] grid place-items-center p-6"
          role="status"
        >
          <div className="event-success-modal">
            <div aria-hidden="true" className="event-success-icon">
              ✓
            </div>
            <p className="event-success-title">¡Contraseña actualizada!</p>
            <p className="event-success-message">
              Tu contraseña se cambió correctamente. Te llevaremos al inicio de
              sesión.
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
