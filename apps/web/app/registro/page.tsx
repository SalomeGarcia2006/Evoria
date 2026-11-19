'use client';

import Image from 'next/image';
import { RegistrationForm } from '../../components/auth/RegistrationForm';

export default function RegistrationPage() {
  return (
    <main className="login-page registration-page">
      <div
        aria-hidden="true"
        className="login-page__orb login-page__orb--top"
      />
      <div
        aria-hidden="true"
        className="login-page__orb login-page__orb--bottom"
      />
      <div className="registration-layout">
        <section className="registration-form-column">
          <header className="registration-brand">
            <Image
              alt="EVORIA"
              className="registration-brand__symbol"
              height={90}
              priority
              src="/images/logoevoria.png"
              width={90}
            />
            <div>
              <h1>EVORIA</h1>
              <p>Registro empresarial seguro</p>
            </div>
          </header>

          <section
            aria-labelledby="registration-title"
            className="registration-card"
          >
            <div className="registration-card__intro">
              <span className="registration-card__eyebrow">
                Registro de cuenta
              </span>
              <div className="registration-card__heading">
                <span aria-hidden="true" className="registration-card__icon">
                  <svg fill="none" viewBox="0 0 24 24">
                    <path
                      d="M12 5v14M5 12h14"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="2.35"
                    />
                  </svg>
                </span>
                <div>
                  <h2 id="registration-title">Crea tu cuenta</h2>
                  <p>
                    Completa tus datos con el enlace de invitación de tu
                    empresa.
                  </p>
                </div>
              </div>
            </div>
            <RegistrationForm />
          </section>
        </section>

        <section
          aria-labelledby="registration-showcase-title"
          className="registration-showcase"
        >
          <div className="registration-showcase__content">
            <h2 id="registration-showcase-title">EVORIA</h2>
            <p>Donde la planificación se convierte en resultados.</p>
            <span aria-hidden="true" className="registration-showcase__line" />
          </div>
          <div className="registration-illustration">
            <Image
              alt="Herramientas de planificación de eventos de EVORIA"
              fill
              priority
              sizes="(max-width: 900px) 0px, (max-width: 1200px) 44vw, 48vw"
              src="/images/ilustarcionportatil.png"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
