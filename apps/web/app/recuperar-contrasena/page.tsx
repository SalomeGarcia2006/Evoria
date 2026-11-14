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
          <a className="recovery-back" href="/login">
            <span aria-hidden="true">←</span> Volver al inicio de sesión
          </a>
          <div className="recovery-progress" aria-label="Paso 1 de 3">
            <span className="active" />
            <span />
            <span />
          </div>
          <span className="recovery-step">01 · RECUPERA TU CUENTA</span>
          <h2>Recuperar contraseña</h2>
          <p className="recovery-description">
            Ingresa el correo de tu cuenta y te enviaremos un código para
            recuperar el acceso.
          </p>
          <hr className="login-separator" />
          <form className="login-form" onSubmit={submit}>
            <div className="login-field">
              <label htmlFor="recover-email">Correo electrónico</label>
              <div className="login-input-container">
                <input
                  id="recover-email"
                  placeholder="nombre@ejemplo.com"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </div>
            </div>
            {error ? (
              <p className="login-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="login-button" disabled={loading} type="submit">
              {loading ? 'Enviando…' : 'Enviar código'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
