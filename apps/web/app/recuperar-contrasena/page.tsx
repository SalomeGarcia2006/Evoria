'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { apiErrorMessage } from '../../services/api';
import { requestPasswordReset } from '../../services/auth.service';

export default function RecoverPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email);
      sessionStorage.setItem('passwordResetEmail', email);
      sessionStorage.removeItem('passwordResetCode');
      router.push('/verificar-contrasena');
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
            <p>Recupera el acceso a tu cuenta</p>
          </div>
        </header>
        <section className="login-card recovery-card">
          <div className="recovery-card__intro">
            <span className="recovery-card__step">Paso 1 de 3</span>
            <div className="recovery-card__heading">
              <span aria-hidden="true" className="recovery-card__icon">
                <svg fill="none" viewBox="0 0 24 24">
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
              </span>
              <div>
                <h2>Recupera tu contraseña</h2>
                <p>
                  Te enviaremos un código para verificar tu identidad y crear
                  una nueva contraseña.
                </p>
              </div>
            </div>
          </div>
          <hr className="login-separator" />
          <form className="login-form" onSubmit={submit}>
            <div className="login-field">
              <label htmlFor="recover-email">Correo electrónico</label>
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
                  autoComplete="email"
                  id="recover-email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="correo@empresa.com"
                  required
                  type="email"
                  value={email}
                />
              </div>
            </div>
            <p className="recovery-card__hint">
              Revisa también la carpeta de correo no deseado.
            </p>
            {error ? (
              <p className="login-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="login-button" disabled={loading} type="submit">
              {loading ? 'Enviando…' : 'Enviar código'}
            </button>
            <a className="recovery-card__back" href="/login">
              ← Volver al inicio de sesión
            </a>
          </form>
        </section>
      </div>
    </main>
  );
}
