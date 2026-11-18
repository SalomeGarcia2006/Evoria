'use client';

import Image from 'next/image';
import { RegistrationForm } from '../../components/auth/RegistrationForm';

export default function RegistrationPage() {
  return (
    <main className="login-page">
      <div aria-hidden="true" className="login-wave login-wave-top" />
      <div aria-hidden="true" className="login-wave login-wave-bottom" />
      <div className="login-container registration-container">
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
            <p>Registro empresarial seguro</p>
          </div>
        </header>
        <section className="login-card recovery-card registration-card">
          <div className="recovery-card__intro">
            <span className="recovery-card__step">Registro de cuenta</span>
            <div className="recovery-card__heading">
              <span aria-hidden="true" className="recovery-card__icon">
                +
              </span>
              <div>
                <h2>Crea tu cuenta</h2>
                <p>
                  Completa tus datos con el enlace de invitación de tu empresa.
                </p>
              </div>
            </div>
          </div>
          <hr className="login-separator" />
          <RegistrationForm />
        </section>
      </div>
    </main>
  );
}
