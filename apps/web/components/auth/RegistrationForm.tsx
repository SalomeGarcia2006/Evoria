'use client';

import { useEffect, useRef, useState } from 'react';
import { apiErrorMessage } from '../../services/api';
import {
  confirmRegistration,
  getRegistrationCompany,
  requestRegistration,
  type RegistrationCompany,
} from '../../services/auth.service';

const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,128}$/;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

function PasswordVisibilityButton({
  visible,
  onClick,
  label,
}: {
  visible: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${label}`}
      className="login-toggle-password"
      onClick={onClick}
      type="button"
    >
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <path
          d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <circle
          cx="12"
          cy="12"
          r="2.5"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    </button>
  );
}

export function RegistrationForm() {
  const tokenRef = useRef('');
  const [company, setCompany] = useState<RegistrationCompany | null>(null);
  const [requiresInvitation, setRequiresInvitation] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState(true);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);
  const codeInputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    let active = true;
    const registrationToken = new URLSearchParams(window.location.search)
      .get('token')
      ?.trim();

    if (!registrationToken) {
      queueMicrotask(() => {
        if (!active) return;
        setRequiresInvitation(true);
        setLoadingLink(false);
      });
      return () => {
        active = false;
      };
    }

    if (!TOKEN_PATTERN.test(registrationToken)) {
      queueMicrotask(() => {
        if (!active) return;
        setLinkError('El enlace de registro no es válido.');
        setLoadingLink(false);
      });
      return () => {
        active = false;
      };
    }

    tokenRef.current = registrationToken;
    void getRegistrationCompany(registrationToken)
      .then((registrationCompany) => {
        if (active) setCompany(registrationCompany);
      })
      .catch((cause: unknown) => {
        if (active) setLinkError(apiErrorMessage(cause));
      })
      .finally(() => {
        if (active) setLoadingLink(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = code.replace(/\s/g, '');
  const codeCharacters = Array.from(
    { length: 6 },
    (_, index) => code[index] ?? '',
  );

  function validateDetails(): string | null {
    const normalizedName = name.trim();
    const normalizedLastName = lastName.trim();
    if (normalizedName.length < 2 || normalizedName.length > 120)
      return 'Ingresa un nombre válido de 2 a 120 caracteres.';
    if (normalizedLastName.length < 2 || normalizedLastName.length > 120)
      return 'Ingresa apellidos válidos de 2 a 120 caracteres.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))
      return 'Ingresa un correo electrónico válido.';
    if (normalizedEmail.split('@')[1] !== company?.emailDomain)
      return `Usa tu correo corporativo @${company?.emailDomain}.`;
    if (!PASSWORD_PATTERN.test(password))
      return 'La contraseña debe tener entre 8 y 128 caracteres, una minúscula, una mayúscula, un número y un carácter especial.';
    if (password !== confirmation) return 'Las contraseñas no coinciden.';
    return null;
  }

  async function submitDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateDetails();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await requestRegistration({
        token: tokenRef.current,
        name: name.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        password,
      });
      setCode('');
      setStep(2);
      window.setTimeout(() => codeInputs.current[0]?.focus(), 0);
    } catch (cause) {
      setError(apiErrorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateCode(index: number, value: string) {
    const characters = value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6 - index);

    setCode((current) => {
      const next = current.padEnd(6, ' ').split('');
      if (!characters) next[index] = '';
      for (let offset = 0; offset < characters.length; offset++)
        next[index + offset] = characters[offset];
      return next.join('').trimEnd();
    });

    if (characters)
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

  async function submitCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
      setError('Ingresa los seis caracteres del código.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await confirmRegistration({
        token: tokenRef.current,
        email: normalizedEmail,
        code: normalizedCode,
      });
      setRegistered(true);
    } catch (cause) {
      setError(apiErrorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loadingLink)
    return (
      <p className="registration-loading">Comprobando enlace de registro…</p>
    );

  if (linkError || !company)
    return (
      <div className="registration-empty">
        {requiresInvitation ? (
          <>
            <h3>Necesitas un enlace empresarial</h3>
            <p>
              Solicítalo a la persona administradora de tu empresa. Ese enlace
              identifica la empresa y permite usar únicamente su correo
              corporativo.
            </p>
          </>
        ) : (
          <p className="login-error" role="alert">
            {linkError ?? 'El enlace de registro no está disponible.'}
          </p>
        )}
        <a className="recovery-card__back" href="/login">
          Volver al inicio de sesión
        </a>
      </div>
    );

  if (registered)
    return (
      <div className="registration-complete" role="status">
        <div aria-hidden="true" className="event-success-icon">
          ✓
        </div>
        <h2>¡Registro confirmado!</h2>
        <p>
          Tu cuenta fue creada en {company.companyName}. Un administrador debe
          asignarte un perfil antes de que puedas acceder a los módulos.
        </p>
        <a className="login-button registration-login-link" href="/login">
          Ir a iniciar sesión
        </a>
      </div>
    );

  return (
    <>
      <div className="registration-company" aria-label="Empresa del registro">
        <span>Registro para</span>
        <strong>{company.companyName}</strong>
        <small>Correo corporativo: @{company.emailDomain}</small>
      </div>
      <div className="recovery-progress" aria-label={`Paso ${step} de 2`}>
        <span className={step >= 1 ? 'active' : undefined} />
        <span className={step >= 2 ? 'active' : undefined} />
      </div>
      {step === 1 ? (
        <form className="login-form" noValidate onSubmit={submitDetails}>
          <div className="registration-fields">
            <div className="login-field">
              <label htmlFor="registration-name">Nombre</label>
              <div className="login-input-container">
                <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                  <circle
                    cx="12"
                    cy="8"
                    r="3.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M4.5 20c.65-3.25 3.05-5 7.5-5s6.85 1.75 7.5 5"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.8"
                  />
                </svg>
                <input
                  autoComplete="given-name"
                  id="registration-name"
                  maxLength={120}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ingresa tu nombre"
                  required
                  value={name}
                />
              </div>
            </div>
            <div className="login-field">
              <label htmlFor="registration-last-name">Apellidos</label>
              <div className="login-input-container">
                <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                  <circle
                    cx="12"
                    cy="8"
                    r="3.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M4.5 20c.65-3.25 3.05-5 7.5-5s6.85 1.75 7.5 5"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.8"
                  />
                </svg>
                <input
                  autoComplete="family-name"
                  id="registration-last-name"
                  maxLength={120}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder="Ingresa tus apellidos"
                  required
                  value={lastName}
                />
              </div>
            </div>
          </div>
          <div className="login-field">
            <label htmlFor="registration-email">Correo corporativo</label>
            <div className="login-input-container">
              <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                <rect
                  height="14"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  width="18"
                  x="3"
                  y="5"
                />
                <path
                  d="m4.5 7 7.5 5.7L19.5 7"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
              <input
                autoComplete="email"
                id="registration-email"
                maxLength={150}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={`nombre@${company.emailDomain}`}
                required
                type="email"
                value={email}
              />
            </div>
          </div>
          <div className="registration-fields">
            <div className="login-field">
              <label htmlFor="registration-password">Contraseña</label>
              <div className="login-input-container">
                <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                  <rect
                    height="10"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    width="14"
                    x="5"
                    y="11"
                  />
                  <path
                    d="M8 11V8a4 4 0 1 1 8 0v3"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.8"
                  />
                </svg>
                <input
                  autoComplete="new-password"
                  id="registration-password"
                  maxLength={128}
                  minLength={8}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Crea una contraseña"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                />
                <PasswordVisibilityButton
                  label="contraseña"
                  onClick={() => setShowPassword((visible) => !visible)}
                  visible={showPassword}
                />
              </div>
            </div>
            <div className="login-field">
              <label htmlFor="registration-confirmation">
                Repite la contraseña
              </label>
              <div className="login-input-container">
                <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                  <rect
                    height="10"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    width="14"
                    x="5"
                    y="11"
                  />
                  <path
                    d="M8 11V8a4 4 0 1 1 8 0v3"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.8"
                  />
                </svg>
                <input
                  autoComplete="new-password"
                  id="registration-confirmation"
                  maxLength={128}
                  minLength={8}
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder="Repite tu contraseña"
                  required
                  type={showConfirmation ? 'text' : 'password'}
                  value={confirmation}
                />
                <PasswordVisibilityButton
                  label="confirmación de contraseña"
                  onClick={() => setShowConfirmation((visible) => !visible)}
                  visible={showConfirmation}
                />
              </div>
            </div>
          </div>
          <p className="recovery-card__hint">
            Usa entre 8 y 128 caracteres, con minúscula, mayúscula, número y
            carácter especial.
          </p>
          {error ? (
            <p className="login-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="login-button"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Enviando código…' : 'Continuar'}
          </button>
        </form>
      ) : (
        <form className="login-form" noValidate onSubmit={submitCode}>
          <div className="recovery-card__heading registration-code-heading">
            <span aria-hidden="true" className="recovery-card__icon">
              <svg fill="none" viewBox="0 0 24 24">
                <rect
                  height="14"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  width="18"
                  x="3"
                  y="5"
                />
                <path
                  d="m4.5 7 7.5 5.7L19.5 7"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            </span>
            <div>
              <h2>Verifica tu correo</h2>
              <p>Enviamos un código de seis caracteres a {normalizedEmail}.</p>
            </div>
          </div>
          <div className="login-field registration-code-field">
            <label htmlFor="registration-code-0">Código de verificación</label>
            <div
              className="verification-code-inputs"
              aria-label="Código de registro de 6 caracteres"
            >
              {codeCharacters.map((character, index) => (
                <input
                  aria-label={`Carácter ${index + 1} del código`}
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  id={index === 0 ? 'registration-code-0' : undefined}
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
                  value={character}
                />
              ))}
            </div>
            <p className="recovery-card__hint">
              El código vence en 10 minutos y permite hasta cinco intentos.
            </p>
          </div>
          {error ? (
            <p className="login-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="login-button"
            disabled={isSubmitting || normalizedCode.length !== 6}
            type="submit"
          >
            {isSubmitting ? 'Confirmando registro…' : 'Confirmar registro'}
          </button>
          <button
            className="recovery-card__back registration-back-button"
            onClick={() => {
              setError(null);
              setStep(1);
            }}
            type="button"
          >
            ← Volver a mis datos
          </button>
        </form>
      )}
      <a className="recovery-card__back" href="/login">
        Volver al inicio de sesión
      </a>
    </>
  );
}
