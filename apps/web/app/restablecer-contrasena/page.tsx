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
          <a className="recovery-back" href="/verificar-contrasena">
            <span aria-hidden="true">←</span> Volver al código
          </a>
          <div className="recovery-progress" aria-label="Paso 3 de 3">
            <span className="active" />
            <span className="active" />
            <span className="active" />
          </div>
          <span className="recovery-step">03 · PROTEGE TU CUENTA</span>
          <h2>Nueva contraseña</h2>
          <p className="recovery-description">
            Crea una contraseña segura para volver a entrar a tu cuenta.
          </p>
          <hr className="login-separator" />
          <form className="login-form" onSubmit={submit}>
            <div className="login-field">
              <label htmlFor="reset-password">Nueva contraseña</label>
              <div className="login-input-container">
                <input
                  id="reset-password"
                  minLength={8}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </div>
            </div>
            <div className="login-field">
              <label htmlFor="reset-confirmation">Repite la contraseña</label>
              <div className="login-input-container">
                <input
                  id="reset-confirmation"
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                  type="password"
                  value={confirmation}
                />
              </div>
            </div>
            <p className="text-sm text-muted">
              Mínimo 8 caracteres, con mayúscula, minúscula, número y carácter
              especial.
            </p>
            {done ? (
              <p className="login-success" role="status">
                Contraseña actualizada. Redirigiendo al inicio de sesión…
              </p>
            ) : null}
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
          </form>
        </section>
      </div>
    </main>
  );
}
