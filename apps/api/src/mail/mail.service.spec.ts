import assert from 'node:assert/strict';
import { test } from 'node:test';
import nodemailer, { type SendMailOptions } from 'nodemailer';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MailService } from './mail.service';

const settings = {
  BREVO_SMTP_USER: 'cuenta@smtp-brevo.com',
  BREVO_SMTP_KEY: 'clave-de-prueba',
  MAIL_FROM_EMAIL: 'remitente@ejemplo.com',
};

test('envía el correo por Brevo con TLS y el remitente configurado', async (t) => {
  let message: SendMailOptions | undefined;
  t.mock.method(nodemailer, 'createTransport', (options: unknown) => {
    assert.deepEqual(options, {
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      requireTLS: true,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
      auth: {
        user: settings.BREVO_SMTP_USER,
        pass: settings.BREVO_SMTP_KEY,
      },
    });
    return {
      sendMail: async (input: SendMailOptions) => {
        message = input;
      },
    } as never;
  });

  const service = new MailService({
    get: (key: keyof typeof settings) => settings[key],
  } as never);
  await service.send('proveedor@ejemplo.com', 'Asunto', 'Contenido');

  assert.deepEqual(message, {
    from: { name: 'Evoria', address: settings.MAIL_FROM_EMAIL },
    to: 'proveedor@ejemplo.com',
    subject: 'Asunto',
    text: 'Contenido',
  });

  await service.send(
    'proveedor@ejemplo.com',
    'Asunto',
    'Contenido',
    '<p>Contenido</p>',
  );
  assert.equal((message as SendMailOptions).html, '<p>Contenido</p>');
});

test('rechaza configuración incompleta y destinatarios inválidos', async () => {
  const incomplete = new MailService({ get: () => undefined } as never);
  await assert.rejects(
    incomplete.send('proveedor@ejemplo.com', 'Asunto', 'Contenido'),
    /Configura BREVO_SMTP_USER/,
  );

  const configured = new MailService({
    get: (key: keyof typeof settings) => settings[key],
  } as never);
  await assert.rejects(
    configured.send('correo-invalido', 'Asunto', 'Contenido'),
    /no es válido/,
  );
});

test('usa un servidor SMTP configurable sin credenciales de Brevo', async (t) => {
  let message: SendMailOptions | undefined;
  t.mock.method(nodemailer, 'createTransport', (options: unknown) => {
    assert.deepEqual(options, {
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      requireTLS: false,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
      auth: { user: 'resend', pass: 'clave-de-prueba' },
    });
    return {
      sendMail: async (input: SendMailOptions) => {
        message = input;
      },
    } as never;
  });

  const configuration: Record<string, string> = {
    SMTP_HOST: 'smtp.resend.com',
    SMTP_PORT: '465',
    SMTP_USER: 'resend',
    SMTP_PASSWORD: 'clave-de-prueba',
    MAIL_FROM_EMAIL: 'remitente@ejemplo.com',
  };
  const service = new MailService({
    get: (key: string) => configuration[key],
  } as never);
  await service.send('proveedor@ejemplo.com', 'Asunto', 'Contenido');
  assert.equal(message?.to, 'proveedor@ejemplo.com');
});

test('guarda el correo en el buzón local sin credenciales SMTP', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'evoria-mail-'));
  try {
    const service = new MailService({
      get: (key: string) =>
        key === 'LOCAL_MAIL_OUTBOX_DIR' ? directory : undefined,
    } as never);
    await service.send(
      'proveedor@ejemplo.com',
      'Confirma tu servicio',
      'Enlace de confirmación',
      '<p>Enlace de confirmación</p>',
    );
    const files = await readdir(directory);
    assert.equal(files.length, 1);
    const message = JSON.parse(
      await readFile(join(directory, files[0]), 'utf8'),
    ) as { to: string; subject: string; text: string; html: string };
    assert.deepEqual(message, {
      to: 'proveedor@ejemplo.com',
      subject: 'Confirma tu servicio',
      text: 'Enlace de confirmación',
      html: '<p>Enlace de confirmación</p>',
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
