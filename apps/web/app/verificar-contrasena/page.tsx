'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { apiErrorMessage } from '../../services/api';
import { verifyPasswordReset } from '../../services/auth.service';

export default function VerifyPasswordPage() {
  const router = useRouter();
  const [code, setCode] = useState(Array<string>(6).fill(''));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function fillCode(index: number, value: string) {
    const characters = value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6 - index);
    const next = [...code];
    if (!characters) next[index] = '';
    else
      [...characters].forEach((character, offset) => {
        next[index + offset] = character;
      });
    setCode(next);
    if (characters)
      inputs.current[Math.min(index + characters.length, 5)]?.focus();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const email = sessionStorage.getItem('passwordResetEmail');
      if (!email) {
        router.replace('/recuperar-contrasena');
        return;
      }
      const normalizedCode = code.join('');
      await verifyPasswordReset(email, normalizedCode);
      sessionStorage.setItem('passwordResetCode', normalizedCode);
      router.push('/restablecer-contrasena');
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
        <section className="login-card recovery-card">
          <a className="recovery-back" href="/recuperar-contrasena">
            <span aria-hidden="true">←</span> Cambiar correo
          </a>
          <div className="recovery-progress" aria-label="Paso 2 de 3">
            <span className="active" />
            <span className="active" />
            <span />
          </div>
          <span className="recovery-step">02 · VERIFICA TU IDENTIDAD</span>
          <h2>Verificar código</h2>
          <p className="recovery-description">
            Si el correo pertenece a una cuenta activa, recibirás un código.
            Escríbelo para continuar.
          </p>
          <hr className="login-separator" />
          <form className="login-form" onSubmit={submit}>
            <fieldset className="login-field">
              <legend>Código de 6 caracteres</legend>
              <div className="recovery-code">
                {code.map((character, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      inputs.current[index] = element;
                    }}
                    aria-label={`Carácter ${index + 1} de 6`}
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    value={character}
                    onChange={(event) => fillCode(index, event.target.value)}
                    onFocus={(event) => event.target.select()}
                    onPaste={(event) => {
                      event.preventDefault();
                      fillCode(index, event.clipboardData.getData('text'));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Backspace' && !character && index > 0)
                        inputs.current[index - 1]?.focus();
                    }}
                    required
                  />
                ))}
              </div>
            </fieldset>
            {error ? (
              <p className="login-error" role="alert">
                {error}
              </p>
            ) : null}
            <button
              className="login-button"
              disabled={loading || code.some((character) => !character)}
              type="submit"
            >
              {loading ? 'Verificando…' : 'Verificar código'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
