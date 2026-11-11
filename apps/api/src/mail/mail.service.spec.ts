import assert from 'node:assert/strict';
import { test } from 'node:test';
import nodemailer, { type SendMailOptions } from 'nodemailer';
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
