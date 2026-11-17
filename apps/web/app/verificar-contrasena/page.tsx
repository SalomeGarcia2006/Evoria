'use client';

import { useEffect, useRef, useState } from 'react';
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
  const codeInputs = useRef<Array<HTMLInputElement | null>>([]);
  const codeCharacters = Array.from(
    { length: 6 },
    (_, index) => code[index] ?? '',
  );

  useEffect(() => {
    // The email comes from the previous page through the URL.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmail(new URLSearchParams(window.location.search).get('email') ?? '');
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = code.replace(/\s/g, '');
    if (normalizedCode.length !== 6) {
      setError('Ingresa los 6 caracteres del código.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
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

  function updateCode(index: number, value: string) {
    const characters = value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
    if (!characters) {
      setCode((current) => {
        const next = current.padEnd(6, ' ').split('');
        next[index] = '';
        return next.join('').trimEnd();
      });
      return;
    }

    setCode((current) => {
      const next = current.padEnd(6, ' ').split('');
      Array.from(characters).forEach((character, offset) => {
        if (index + offset < 6) next[index + offset] = character;
      });
      return next.join('').trimEnd();
    });
    codeInputs.current[Math.min(index + characters.length, 5)]?.focus();
  }

  function handleCodeKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) {
    if (event.key === 'Backspace' && !codeCharacters[index] && index > 0) {
      event.preventDefault();
      updateCode(index - 1, '');
      codeInputs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      codeInputs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowRight' && index < 5) {
      event.preventDefault();
      codeInputs.current[index + 1]?.focus();
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
        <section className="login-card recovery-card verification-card">
          <div className="recovery-card__intro">
            <span className="recovery-card__step">Paso 2 de 3</span>
            <div className="recovery-card__heading">
              <span aria-hidden="true" className="recovery-card__icon">
                <svg fill="none" viewBox="0 0 24 24">
                  <path
                    d="M4 12.5 9 17l11-11"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              </span>
              <div>
                <h2>Verifica tu código</h2>
                <p>
                  Escribe el código de seis caracteres que enviamos a tu correo.
                </p>
              </div>
            </div>
          </div>
          <hr className="login-separator" />
          <form className="login-form" onSubmit={submit}>
            <div className="login-field">
              <label htmlFor="verify-code-0">Código de recuperación</label>
              <div
                aria-label="Código de recuperación de 6 caracteres"
                className="verification-code-inputs"
              >
                {codeCharacters.map((character, index) => (
                  <input
                    aria-label={`Carácter ${index + 1} del código`}
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    inputMode="text"
                    key={index}
                    maxLength={6}
                    onChange={(event) => updateCode(index, event.target.value)}
                    onKeyDown={(event) => handleCodeKeyDown(event, index)}
                    onPaste={(event) => {
                      event.preventDefault();
                      updateCode(index, event.clipboardData.getData('text'));
                    }}
                    ref={(element) => {
                      codeInputs.current[index] = element;
                    }}
                    required
                    type="text"
                    value={character}
                  />
                ))}
              </div>
              <p className="recovery-card__hint">
                El código vence en 10 minutos. Puedes pegarlo completo aquí.
              </p>
            </div>
            {error ? (
              <p className="login-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="login-button" disabled={loading} type="submit">
              {loading ? 'Verificando…' : 'Verificar código'}
            </button>
            <div className="recovery-card__links">
              <a className="recovery-card__back" href="/recuperar-contrasena">
                ← Cambiar correo
              </a>
              <a className="recovery-card__back" href="/login">
                Volver al inicio de sesión
              </a>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
