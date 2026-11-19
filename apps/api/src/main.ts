import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';

async function createApplication() {
  const app = await NestFactory.create(AppModule);
  const webOrigin = process.env.WEB_ORIGIN?.trim() || 'http://localhost:3000';

  app.enableCors({
    origin: webOrigin,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.init();
  return app;
}

let applicationPromise: ReturnType<typeof createApplication> | undefined;

function getApplication() {
  applicationPromise ??= createApplication();
  return applicationPromise;
}

export default async function handler(req: Request, res: Response) {
  const app = await getApplication();
  const expressApp = app.getHttpAdapter().getInstance() as (
    request: Request,
    response: Response,
  ) => void;
  expressApp(req, res);
}

if (process.env.VERCEL !== '1') {
  void getApplication().then((app) =>
    app.listen(Number(process.env.PORT ?? 3001)),
  );
}
