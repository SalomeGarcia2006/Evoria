'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { apiErrorMessage } from '../../services/api';
import { verifyPasswordReset } from '../../services/auth.service';

export default function VerifyPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // The email comes from the previous page through the URL.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmail(new URLSearchParams(window.location.search).get('email') ?? '');
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const normalizedCode = code.toUpperCase();
      await verifyPasswordReset(email, normalizedCode);
      router.push(
        `/restablecer-contrasena?email=${encodeURIComponent(email)}&code=${normalizedCode}`,
      );
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
            <p>Verifica tu código de recuperación</p>
          </div>
        </header>
        <section className="login-card">
          <h2>Verificar código</h2>
          <hr className="login-separator" />
          <form className="login-form" onSubmit={submit}>
            <div className="login-field">
              <label htmlFor="verify-code">Código de 6 caracteres</label>
              <div className="login-input-container">
                <input
                  id="verify-code"
                  maxLength={6}
                  minLength={6}
                  onChange={(event) =>
                    setCode(
                      event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, ''),
                    )
                  }
                  required
                  type="text"
                  value={code}
                />
              </div>
            </div>
            {error ? (
              <p className="login-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="login-button" disabled={loading} type="submit">
              {loading ? 'Verificando…' : 'Verificar código'}
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
