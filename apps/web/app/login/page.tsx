import Image from 'next/image';
import { LoginForm } from '../../components/auth/LoginForm';

export default function LoginPage() {
  return (
    <main className="login-page">
      <div
        aria-hidden="true"
        className="login-page__orb login-page__orb--top"
      />
      <div
        aria-hidden="true"
        className="login-page__orb login-page__orb--bottom"
      />

      <div className="login-layout">
        <section className="login-showcase" aria-labelledby="login-brand-name">
          <header className="login-brand">
            <Image
              alt=""
              className="login-brand__symbol"
              height="127"
              src="/images/logoevoria.png"
              width="131"
            />
            <div>
              <h1 id="login-brand-name">EVORIA</h1>
              <p>Sistema Inteligente de Logística y Planificación de Eventos</p>
            </div>
          </header>

          <div className="login-showcase__content">
            <h2>
              Organiza, planifica y ejecuta tus eventos{' '}
              <span>en un solo lugar.</span>
            </h2>
            <ul className="login-features" aria-label="Funciones de EVORIA">
              <li>
                <Image alt="" height="26" src="/icons/FECHA.svg" width="26" />
                Gestión de eventos
              </li>
              <li>
                <Image
                  alt=""
                  height="26"
                  src="/icons/inventario.svg"
                  width="26"
                />
                Recursos e inventario
              </li>
              <li>
                <Image
                  alt=""
                  height="26"
                  src="/icons/presupuesto.svg"
                  width="26"
                />
                Presupuestos
              </li>
              <li>
                <Image alt="" height="26" src="/icons/alerta.svg" width="26" />
                Alertas y reportes
              </li>
            </ul>
          </div>

          <div aria-hidden="true" className="login-illustration">
            <Image
              alt=""
              priority
              sizes="(max-width: 880px) 0px, 46vw"
              src="/images/ilustarcionportatil.png"
              fill
            />
          </div>
        </section>

        <section className="login-card" aria-labelledby="login-title">
          <header className="login-card__header">
            <h2 id="login-title">Iniciar sesión</h2>
            <p>Accede a tu cuenta de EVORIA</p>
          </header>
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
