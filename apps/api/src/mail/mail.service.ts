import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';
import nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  constructor(private readonly config: ConfigService) {}

  async send(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<void> {
    const user = this.config.get<string>('BREVO_SMTP_USER')?.trim();
    const pass = this.config.get<string>('BREVO_SMTP_KEY')?.trim();
    const from = this.config.get<string>('MAIL_FROM_EMAIL')?.trim();

    if (!user || !pass || !from) {
      throw new Error(
        'Configura BREVO_SMTP_USER, BREVO_SMTP_KEY y MAIL_FROM_EMAIL.',
      );
    }
    if (!isEmail(from) || !isEmail(to)) {
      throw new Error('El correo remitente o destinatario no es válido.');
    }

    const transport = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      requireTLS: true,
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
