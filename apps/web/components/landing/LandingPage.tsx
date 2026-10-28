'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react';
import { Particles } from './Particles';
import './landing.css';

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [contactDraft, setContactDraft] = useState<string | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function navigateSection(event: MouseEvent<HTMLDivElement>) {
    const anchor = (event.target as Element).closest<HTMLAnchorElement>(
      'a[href^="#"]',
    );
    const href = anchor?.getAttribute('href');
    if (!href || href === '#') return;
    const section = document.getElementById(href.slice(1));
    if (!section) return;
    event.preventDefault();
    section.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'start',
    });
    window.history.pushState(null, '', href);
  }

  function prepareContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const subject =
      'Consulta sobre EVORIA - ' + String(fields.get('nombre') ?? '').trim();
    const body = [
      String(fields.get('mensaje') ?? '').trim(),
      '',
      'Nombre: ' + String(fields.get('nombre') ?? '').trim(),
      'Correo: ' + String(fields.get('correo') ?? '').trim(),
    ].join('\n');
    setContactDraft(
      'mailto:mgarcia06calle@gmail.com?subject=' +
        encodeURIComponent(subject) +
        '&body=' +
        encodeURIComponent(body),
    );
  }

  return (
    <div className="evoria-landing" onClick={navigateSection}>
      <nav
        className={scrolled ? 'navbar scrolled' : 'navbar'}
        aria-label="Navegación de EVORIA"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setMenuOpen(false);
            toggleRef.current?.focus();
          }
        }}
      >
        <div className="nav-brand">
          <Image
            width={348}
            height={204}
            src="/landing/logo.png"
            alt="EVORIA"
            className="evoria-logo"
          />
          <span className="nav-brand-name">EVORIA</span>
        </div>
        <div
          id="landing-navigation"
          className={menuOpen ? 'nav-links active' : 'nav-links'}
          onClick={() => setMenuOpen(false)}
        >
          <a href="#inicio">Inicio</a>
          <a href="#que-es">¿Qué es?</a>
          <a href="#modulos">Módulos</a>
          <a href="#equipo">Equipo</a>
          <a href="#contacto">Contacto</a>
          <Link href="/login" className="nav-login">
            Iniciar sesión
          </Link>
        </div>
        <button
          ref={toggleRef}
          type="button"
          className="nav-toggle"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
          aria-controls="landing-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </nav>
      <main>
        <section id="inicio" className="hero">
          <Particles />
          <div className="hero-content">
            <div className="hero-badge">Sistema de Logística y Eventos</div>
            <h1 className="hero-title">EVORIA</h1>
            <p className="hero-subtitle">
              Donde la planificación se convierte en resultados
            </p>
            <p className="hero-description">
              Centraliza la gestión de eventos, recursos, inventario,
              presupuestos y cronogramas en una sola plataforma web. Optimiza la
              toma de decisiones, reduce errores humanos y mejora la eficiencia
              operativa en la organización de eventos.
            </p>
            <div className="hero-buttons">
              <a href="#modulos" className="btn btn-primary">
                Explorar Módulos
              </a>
              <a href="#que-es" className="btn btn-outline">
                Conocer Más
              </a>
            </div>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-number">6</span>
                <span className="stat-label">Módulos</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat">
                <span className="stat-number">8</span>
                <span className="stat-label">Casos de Uso</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat">
                <span className="stat-number">12</span>
                <span className="stat-label">Historias</span>
              </div>
            </div>
          </div>
        </section>

        <section id="que-es" className="section about">
          <div className="container">
            <div className="section-header">
              <span className="section-tag">Sobre el Proyecto</span>
              <h2 className="section-title">
                ¿Qué es <span className="highlight">EVORIA</span>?
              </h2>
              <p className="section-desc">
                EVORIA es un sistema web diseñado para apoyar la planificación y
                ejecución de eventos, permitiendo gestionar recursos humanos,
                inventario, proveedores, presupuestos y cronogramas de forma
                organizada.
              </p>
            </div>
            <div className="about-grid">
              <div className="about-card">
                <div className="about-icon">📊</div>
                <h3>Gestión Integral</h3>
                <p>
                  Administra eventos, recursos, inventario y presupuestos en una
                  única plataforma centralizada.
                </p>
              </div>
              <div className="about-card">
                <div className="about-icon">⚡</div>
                <h3>Automatización</h3>
                <p>
                  Automatiza la asignación de recursos, generación de
                  cronogramas y cálculo de presupuestos.
                </p>
              </div>
              <div className="about-card">
                <div className="about-icon">✅</div>
                <h3>Control de Calidad</h3>
                <p>
                  Detecta conflictos de planificación, emite alertas y registra
                  auditoría de cambios.
                </p>
              </div>
              <div className="about-card">
                <div className="about-icon">🎯</div>
                <h3>Toma de Decisiones</h3>
                <p>
                  Proporciona información oportuna y reportes para optimizar la
                  toma de decisiones.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="section problem-solution">
          <div className="container">
            <div className="ps-grid">
              <div className="ps-card problem">
                <div className="ps-header">
                  <span className="ps-icon">⚠️</span>
                  <span className="ps-tag problem-tag">Problema</span>
                </div>
                <h3>¿Por qué necesitas EVORIA?</h3>
                <ul className="ps-list">
                  <li>
                    <span className="ps-bullet problem">✕</span> Mala
                    planificación del tiempo
                  </li>
                  <li>
                    <span className="ps-bullet problem">✕</span> Asignación
                    ineficiente de recursos
                  </li>
                  <li>
                    <span className="ps-bullet problem">✕</span> Falta de
                    control en costos y presupuesto
                  </li>
                  <li>
                    <span className="ps-bullet problem">✕</span> Errores humanos
                    recurrentes en la logística
                  </li>
                  <li>
                    <span className="ps-bullet problem">✕</span> Falta de
                    coordinación entre equipos
                  </li>
                </ul>
              </div>
              <div className="ps-card solution">
                <div className="ps-header">
                  <span className="ps-icon">🚀</span>
                  <span className="ps-tag solution-tag">Solución</span>
                </div>
                <h3>Beneficios de EVORIA</h3>
                <ul className="ps-list">
                  <li>
                    <span className="ps-bullet solution">✓</span> Planificación
                    automatizada de actividades
                  </li>
                  <li>
                    <span className="ps-bullet solution">✓</span> Asignación
                    eficiente de recursos humanos y materiales
                  </li>
                  <li>
                    <span className="ps-bullet solution">✓</span> Control total
                    de costos y presupuestos
                  </li>
                  <li>
                    <span className="ps-bullet solution">✓</span> Reducción de
                    errores mediante validaciones
                  </li>
                  <li>
                    <span className="ps-bullet solution">✓</span> Coordinación
                    centralizada entre equipos
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="modulos" className="section modules">
          <div className="container">
            <div className="section-header">
              <span className="section-tag">Funcionalidades</span>
              <h2 className="section-title">
                Módulos del <span className="highlight">Sistema</span>
              </h2>
              <p className="section-desc">
                EVORIA integra seis módulos principales diseñados para cubrir
                todas las necesidades de logística y planificación de eventos.
              </p>
            </div>
            <div className="modules-grid">
              <div className="module-card">
                <div className="module-number">01</div>
                <div className="module-icon">📅</div>
                <h3>Gestión de Eventos</h3>
                <p>
                  Creación, configuración y seguimiento de eventos con estados
                  en tiempo real.
                </p>
                <div className="module-features">
                  <span>Registrar eventos</span>
                  <span>Estados en tiempo real</span>
                  <span>Validación de fechas</span>
                </div>
              </div>
              <div className="module-card">
                <div className="module-number">02</div>
                <div className="module-icon">👥</div>
                <h3>Recursos Humanos</h3>
                <p>
                  Asignación y control de personal según disponibilidad y
                  perfil.
                </p>
                <div className="module-features">
                  <span>Asignación automática</span>
                  <span>Disponibilidad</span>
                  <span>Control de perfiles</span>
                </div>
              </div>
              <div className="module-card">
                <div className="module-number">03</div>
                <div className="module-icon">📦</div>
                <h3>Inventario</h3>
                <p>
                  Control de recursos materiales, cantidades disponibles y
                  ubicación física.
                </p>
                <div className="module-features">
                  <span>Stock en tiempo real</span>
                  <span>Alertas de faltantes</span>
                  <span>Ubicación física</span>
                </div>
              </div>
              <div className="module-card">
                <div className="module-number">04</div>
                <div className="module-icon">💰</div>
                <h3>Presupuestos</h3>
                <p>
                  Cálculo automático de costos estimados y reales basado en
                  recursos asignados.
                </p>
                <div className="module-features">
                  <span>Cálculo automático</span>
                  <span>Costo estimado vs real</span>
                  <span>Reportes en PDF</span>
                </div>
              </div>
              <div className="module-card">
                <div className="module-number">05</div>
                <div className="module-icon">⏰</div>
                <h3>Cronogramas</h3>
                <p>
                  Generación automática de actividades y horarios para la
                  ejecución del evento.
                </p>
                <div className="module-features">
                  <span>Generación automática</span>
                  <span>Detección de conflictos</span>
                  <span>Visualización clara</span>
                </div>
              </div>
              <div className="module-card">
                <div className="module-number">06</div>
                <div className="module-icon">🔔</div>
                <h3>Alertas y Reportes</h3>
                <p>
                  Notificaciones de conflictos, reportes en PDF y auditoría de
                  cambios.
                </p>
                <div className="module-features">
                  <span>Alertas en tiempo real</span>
                  <span>Exportación PDF</span>
                  <span>Trazabilidad completa</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section usecases">
          <div className="container">
            <div className="section-header">
              <span className="section-tag">Interacciones</span>
              <h2 className="section-title">
                Casos de <span className="highlight">Uso</span>
              </h2>
            </div>
            <div className="usecases-grid">
              <div className="usecase-card">
                <span className="usecase-code">CU-01</span>
                <h3>Iniciar Sesión</h3>
                <p>
                  Autenticación mediante correo y contraseña con validación de
                  credenciales.
                </p>
                <span className="usecase-actor">👤 Administrador</span>
              </div>
              <div className="usecase-card">
                <span className="usecase-code">CU-02</span>
                <h3>Crear Evento</h3>
                <p>
                  Registro de nuevos eventos con nombre, fecha, ubicación y
                  tipo.
                </p>
                <span className="usecase-actor">👤 Coordinador</span>
              </div>
              <div className="usecase-card">
                <span className="usecase-code">CU-03</span>
                <h3>Asignar Recursos</h3>
                <p>
                  Asignación de recursos humanos y materiales según
                  disponibilidad.
                </p>
                <span className="usecase-actor">👤 Administrador</span>
              </div>
              <div className="usecase-card">
                <span className="usecase-code">CU-04</span>
                <h3>Gestionar Inventario</h3>
                <p>
                  Consulta y actualización de recursos disponibles en tiempo
                  real.
                </p>
                <span className="usecase-actor">👤 Administrador</span>
              </div>
              <div className="usecase-card">
                <span className="usecase-code">CU-05</span>
                <h3>Generar Presupuesto</h3>
                <p>
                  Cálculo automático de costos basado en recursos asignados.
                </p>
                <span className="usecase-actor">👤 Coordinador</span>
              </div>
              <div className="usecase-card">
                <span className="usecase-code">CU-06</span>
                <h3>Generar Cronograma</h3>
                <p>
                  Organización automática de actividades y horarios del evento.
                </p>
                <span className="usecase-actor">👤 Coordinador</span>
              </div>
              <div className="usecase-card">
                <span className="usecase-code">CU-07</span>
                <h3>Emitir Alertas</h3>
                <p>
                  Detección de conflictos y notificaciones automáticas al
                  usuario.
                </p>
                <span className="usecase-actor">⚙️ Sistema</span>
              </div>
              <div className="usecase-card">
                <span className="usecase-code">CU-08</span>
                <h3>Generar Reportes</h3>
                <p>
                  Exportación de informes en PDF sobre eventos, recursos y
                  presupuestos.
                </p>
                <span className="usecase-actor">👤 Administrador</span>
              </div>
            </div>
          </div>
        </section>

        <section id="equipo" className="section team">
          <div className="container">
            <div className="section-header">
              <span className="section-tag">Nosotros</span>
              <h2 className="section-title">
                Equipo de <span className="highlight">Trabajo</span>
              </h2>
              <p className="section-desc">
                Proyecto académico desarrollado por estudiantes del SENA
              </p>
            </div>
            <div className="team-grid">
              <div className="team-card">
                <div
                  className="team-avatar"
                  style={{
                    background: 'linear-gradient(135deg, #1a2a3a, #4a6a85)',
                  }}
                >
                  SG
                </div>
                <h3>Salomé García Calle</h3>
                <span className="team-role">Líder del Proyecto</span>
                <span className="team-role">Frontend Developer</span>
                <p>
                  Coordinación del equipo, diseño y desarrollo de interfaces de
                  usuario.
                </p>
              </div>
              <div className="team-card">
                <div
                  className="team-avatar"
                  style={{
                    background: 'linear-gradient(135deg, #4a6a85, #1a2a3a)',
                  }}
                >
                  EC
                </div>
                <h3>Esthefany Chávez Parra</h3>
                <span className="team-role">Backend Developer</span>
                <p>
                  Lógica de negocio, diseño de base de datos y desarrollo de la
                  API REST.
                </p>
              </div>
              <div className="team-card">
                <div
                  className="team-avatar"
                  style={{
                    background: 'linear-gradient(135deg, #1a2a3a, #4a6a85)',
                  }}
                >
                  AM
                </div>
                <h3>Adrián Martínez Dulcey</h3>
                <span className="team-role">Analista</span>
                <p>
                  Recopilación de requerimientos y documentación técnica y
                  funcional.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="contacto" className="section contact">
          <div className="container">
            <div className="section-header">
              <span className="section-tag">Conecta</span>
              <h2 className="section-title">Contáctanos</h2>
              <p className="section-desc">
                ¿Tienes preguntas sobre el proyecto EVORIA?
              </p>
            </div>
            <div className="contact-grid">
              <div className="contact-info">
                <div className="contact-item">
                  <span className="contact-icon">👤</span>
                  <div>
                    <span className="contact-label">Líder del Proyecto</span>
                    <span className="contact-value">Salomé García Calle</span>
                  </div>
                </div>
                <div className="contact-item">
                  <span className="contact-icon">📧</span>
                  <div>
                    <span className="contact-label">Correo Electrónico</span>
                    <span className="contact-value">
                      mgarcia06calle@gmail.com
                    </span>
                  </div>
                </div>
                <div className="contact-item">
                  <span className="contact-icon">🏛️</span>
                  <div>
                    <span className="contact-label">Institución</span>
                    <span className="contact-value">
                      Servicio Nacional de Aprendizaje - SENA
                    </span>
                  </div>
                </div>
                <div className="contact-item">
                  <span className="contact-icon">📅</span>
                  <div>
                    <span className="contact-label">Periodo</span>
                    <span className="contact-value">
                      Junio - Diciembre 2026
                    </span>
                  </div>
                </div>
              </div>
              <form
                className="contact-form"
                id="contactForm"
                onSubmit={prepareContact}
                onChange={() => setContactDraft(null)}
              >
                <div className="form-group">
                  <label htmlFor="nombre">Nombre completo</label>
                  <input
                    type="text"
                    id="nombre"
                    name="nombre"
                    placeholder="Tu nombre"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="correo">Correo electrónico</label>
                  <input
                    type="email"
                    id="correo"
                    name="correo"
                    placeholder="tu@email.com"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="mensaje">Mensaje</label>
                  <textarea
                    id="mensaje"
                    name="mensaje"
                    rows={4}
                    placeholder="Escribe tu mensaje..."
                    required
                  ></textarea>
                </div>
                <button type="submit" className="btn btn-primary btn-full">
                  Preparar correo
                </button>
                <p className="contact-hint">
                  Prepara el mensaje y ábrelo en tu aplicación de correo.
                </p>
                {contactDraft ? (
                  <p role="status" className="contact-hint">
                    <a href={contactDraft}>Abrir mi aplicación de correo</a>
                  </p>
                ) : null}
              </form>
            </div>
          </div>
        </section>
      </main>
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <h3>EVORIA</h3>
              <p>Sistema de Logística y Planificación de Eventos</p>
            </div>
            <div className="footer-links">
              <a href="#inicio">Inicio</a>
              <a href="#modulos">Módulos</a>
              <a href="#equipo">Equipo</a>
              <a href="#contacto">Contacto</a>
            </div>
          </div>
          <div className="footer-bottom">
            <p>
              © 2026 EVORIA. Proyecto formativo desarrollado por aprendices del
              SENA. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
