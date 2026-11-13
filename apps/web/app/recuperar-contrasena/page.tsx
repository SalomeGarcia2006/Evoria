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
      router.push(`/verificar-contrasena?email=${encodeURIComponent(email)}`);
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
        <section className="login-card">
          <h2>Recuperar contraseña</h2>
          <hr className="login-separator" />
          <form className="login-form" onSubmit={submit}>
            <div className="login-field">
              <label htmlFor="recover-email">Correo electrónico</label>
              <div className="login-input-container">
                <input
                  id="recover-email"
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
            <a
              className="text-center text-sm text-muted underline underline-offset-2"
              href="/login"
            >
              Volver al inicio de sesión
            </a>
          </form>
        </section>
      </div>
    </main>
  );
}
