import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';
import nodemailer from 'nodemailer';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

@Injectable()
export class MailService {
  constructor(private readonly config: ConfigService) {}

  async send(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<void> {
    const localOutbox = this.config
      .get<string>('LOCAL_MAIL_OUTBOX_DIR')
      ?.trim();
    if (localOutbox) {
      if (process.env.NODE_ENV === 'production')
        throw new Error('El buzón local no está permitido en producción.');
      if (!isEmail(to)) throw new Error('El correo destinatario no es válido.');
      const directory = resolve(localOutbox);
      await mkdir(directory, { recursive: true });
      await writeFile(
        resolve(
          directory,
          `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.json`,
        ),
        JSON.stringify({ to, subject, text, html: html ?? null }, null, 2),
        { encoding: 'utf8', flag: 'wx' },
      );
      return;
    }
    const customHost = this.config.get<string>('SMTP_HOST')?.trim();
    const portText = this.config.get<string>('SMTP_PORT')?.trim();
    const port = portText ? Number(portText) : 587;
    const user = this.config
      .get<string>(customHost ? 'SMTP_USER' : 'BREVO_SMTP_USER')
      ?.trim();
    const pass = this.config
      .get<string>(customHost ? 'SMTP_PASSWORD' : 'BREVO_SMTP_KEY')
      ?.trim();
    const from = this.config.get<string>('MAIL_FROM_EMAIL')?.trim();

    if (!user || !pass || !from) {
      throw new Error(
        customHost
          ? 'Configura SMTP_USER, SMTP_PASSWORD y MAIL_FROM_EMAIL.'
          : 'Configura BREVO_SMTP_USER, BREVO_SMTP_KEY y MAIL_FROM_EMAIL.',
      );
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('SMTP_PORT debe ser un puerto válido.');
    }
    if (!isEmail(from) || !isEmail(to)) {
      throw new Error('El correo remitente o destinatario no es válido.');
    }

    const transport = nodemailer.createTransport({
      host: customHost || 'smtp-relay.brevo.com',
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
      auth: { user, pass },
    });
    await transport.sendMail({
      from: { name: 'Evoria', address: from },
      to,
      subject,
      text,
      ...(html === undefined ? {} : { html }),
    });
  }
}
