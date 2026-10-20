import Image from 'next/image';
import { LoginForm } from '../../components/auth/LoginForm';

export default function LoginPage() {
  return (
    <main className="login-page">
      <div aria-hidden="true" className="login-wave login-wave-top" />
      <div aria-hidden="true" className="login-wave login-wave-bottom" />

      <div className="login-container">
        <header className="login-brand">
          <div className="login-brand-logo">
            <Image
              alt="Logo de EVORIA"
              height="90"
              src="/images/logoevoria.png"
              width="90"
            />
          </div>
          <div>
            <h1>EVORIA</h1>
            <p>Sistema Inteligente de Logística y Planificación de Eventos</p>
          </div>
        </header>

        <section className="login-card">
          <h2>Iniciar sesión</h2>
          <hr className="login-separator" />
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
