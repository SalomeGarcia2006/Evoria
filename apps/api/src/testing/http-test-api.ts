import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import cookieParser from 'cookie-parser';
import type { AddressInfo } from 'node:net';
import { Types, type Connection } from 'mongoose';
import { AppModule } from '../app.module';
import { AccessControlSeedService } from '../profiles/access-control.seed.service';
import { DEVELOPER_PROFILE_NAME } from '../profiles/profiles.constants';
import { PasswordService } from '../users/password.service';

export interface HttpSession<T = unknown> {
  cookies: string;
  data: T;
}

interface RequestOptions {
  body?: unknown;
  method?: string;
  session?: HttpSession;
}

export interface HttpTestApi {
  connection: Connection;
  login<T = unknown>(email: string, password: string): Promise<HttpSession<T>>;
  request(path: string, options?: RequestOptions): Promise<Response>;
  seedDeveloper(input?: {
    email?: string;
    name?: string;
    password?: string;
  }): Promise<{ id: string; email: string; password: string }>;
  seedAccessControl(): Promise<void>;
  close(): Promise<void>;
}

export interface TenantTestContext {
  developerSession: HttpSession;
  ownerSession: HttpSession;
  tenantId: string;
}

function extractCookies(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';', 1)[0])
    .join('; ');
}

export async function createHttpTestApi(name: string): Promise<HttpTestApi> {
  const database = `evoria_${name}_${new Types.ObjectId().toString()}`;
  const mongoUri = new URL(
    process.env.EVORIA_TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27017',
  );
  mongoUri.pathname = `/${database}`;
  process.env.MONGODB_URI = mongoUri.toString();
  process.env.JWT_ACCESS_SECRET = `${name}-access-secret`;
  process.env.JWT_REFRESH_SECRET = `${name}-refresh-secret`;

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.listen(0, '127.0.0.1');

  const connection = app.get<Connection>(getConnectionToken());
  const address = app.getHttpServer().address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  async function request(
    path: string,
    { body, method = 'GET', session }: RequestOptions = {},
  ): Promise<Response> {
    const headers = new Headers();
    if (session?.cookies) headers.set('Cookie', session.cookies);
    if (body !== undefined) headers.set('Content-Type', 'application/json');

    const response = await fetch(`${baseUrl}/${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    if (session && response.headers.getSetCookie().length) {
      session.cookies = extractCookies(response);
    }

    return response;
  }

  return {
    connection,
    request,
    async login<T>(email: string, password: string): Promise<HttpSession<T>> {
      const response = await request('auth/login', {
        method: 'POST',
        body: { email, password },
      });
      const body = (await response.json()) as { data: T };
      if (!response.ok) {
        throw new Error(`No se pudo iniciar sesión: ${response.status}.`);
      }
      return { cookies: extractCookies(response), data: body.data };
    },
    async seedAccessControl(): Promise<void> {
      await app.get(AccessControlSeedService).seed();
    },
    async seedDeveloper(input = {}) {
      const email = input.email ?? 'developer@example.test';
      const password = input.password ?? 'prueba-segura';
      const profile = await connection.collection('profiles').findOne({
        name: DEVELOPER_PROFILE_NAME,
        scope: 'platform',
      });
      if (!profile) throw new Error('No existe el perfil de desarrollador.');

      const id = new Types.ObjectId();
      await connection.collection('users').insertOne({
        _id: id,
        name: input.name ?? 'Desarrollador de prueba',
        email,
        passwordHash: app.get(PasswordService).hash(password),
        platformProfileId: profile._id,
        status: 'activo',
        loginAttempts: 0,
        lockedUntil: null,
      });
      return { id: id.toString(), email, password };
    },
    async close(): Promise<void> {
      await connection.dropDatabase();
      await app.close();
    },
  };
}

export async function createTenantTestContext(
  api: HttpTestApi,
): Promise<TenantTestContext> {
  await api.seedAccessControl();
  const developer = await api.seedDeveloper();
  const developerSession = await api.login(developer.email, developer.password);
  const tenantResponse = await api.request('tenants', {
    method: 'POST',
    session: developerSession,
    body: {
      name: 'Empresa de prueba',
      nit: '900123456-7',
      ownerName: 'Administrador de prueba',
      ownerEmail: 'owner@example.test',
      ownerPassword: 'prueba-segura',
    },
  });
  if (tenantResponse.status !== 201) {
    throw new Error(`No se pudo crear la empresa: ${tenantResponse.status}.`);
  }
  const tenant = (await tenantResponse.json()) as { data: { id: string } };
  const ownerSession = await api.login('owner@example.test', 'prueba-segura');

  return { developerSession, ownerSession, tenantId: tenant.data.id };
}
