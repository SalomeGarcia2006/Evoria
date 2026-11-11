import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MailModule } from '../mail/mail.module';
import { MailService } from '../mail/mail.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'apps/api/.env'],
    }),
    MailModule,
  ],
})
class TestMailModule {}

async function main() {
  const recipient = process.argv[2];
  if (!recipient) {
    throw new Error(
      'Indica el destinatario: npm run email:test -- correo@ejemplo.com',
    );
  }

  const app = await NestFactory.createApplicationContext(TestMailModule, {
    logger: false,
  });
  try {
    await app
      .get(MailService)
      .send(
        recipient,
        'Prueba de correo de Evoria',
        'Si recibiste este mensaje, el envío de correos de Evoria funciona.',
      );
    process.stdout.write('Correo de prueba aceptado por Brevo.\n');
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'No se pudo enviar el correo.'}\n`,
  );
  process.exitCode = 1;
});
