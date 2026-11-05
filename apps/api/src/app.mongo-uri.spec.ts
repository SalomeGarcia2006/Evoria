import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { getMongoUri } from './app.module';

test('URI de Mongo codifica credenciales y distingue conexión local y de contenedor', () => {
  const base = {
    MONGODB_URI: '',
    MONGO_ROOT_USERNAME: 'usuario@ejemplo',
    MONGO_ROOT_PASSWORD: 'clave:/@?#',
    MONGO_DATABASE: 'evoria',
    MONGO_HOST: 'mongo',
    MONGO_PORT: '27017',
    MONGO_REPLICA_SET: 'evoria-rs',
    MONGO_DIRECT_CONNECTION: 'false',
  };
  const uri = new URL(getMongoUri(new ConfigService(base)));
  assert.equal(decodeURIComponent(uri.username), base.MONGO_ROOT_USERNAME);
  assert.equal(decodeURIComponent(uri.password), base.MONGO_ROOT_PASSWORD);
  assert.equal(uri.hostname, 'mongo');
  assert.equal(uri.searchParams.get('replicaSet'), 'evoria-rs');
  assert.equal(uri.searchParams.get('directConnection'), 'false');
  assert.equal(uri.searchParams.get('authSource'), 'admin');
  const local = new URL(
    getMongoUri(
      new ConfigService({
        ...base,
        MONGO_HOST: 'localhost',
        MONGO_DIRECT_CONNECTION: 'true',
      }),
    ),
  );
  assert.equal(local.hostname, 'localhost');
  assert.equal(local.searchParams.get('directConnection'), 'true');
});

test('MONGODB_URI explícita tiene prioridad', () => {
  const uri = 'mongodb://127.0.0.1:27129/aislada?directConnection=true';
  assert.equal(getMongoUri(new ConfigService({ MONGODB_URI: uri })), uri);
});
