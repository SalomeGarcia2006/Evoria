import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateSync } from 'class-validator';
import type { Model } from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateProviderDto } from './dto/create-provider.dto';
import { FindProvidersDto } from './dto/find-providers.dto';
import { ProvidersService } from './providers.service';
import { Provider } from './schemas/provider.schema';

const user = {
  id: '507f1f77bcf86cd799439011',
  scope: 'tenant',
  tenantId: '507f1f77bcf86cd799439012',
} as AuthenticatedUser;

test('el directorio filtra por empresa, categoría, estado y contacto', async () => {
  let findFilter: Record<string, unknown> = {};
  let countFilter: Record<string, unknown> = {};
  const model = {
    find(filter: Record<string, unknown>) {
      findFilter = filter;
      return {
        sort: () => ({
          skip: () => ({ limit: () => ({ lean: async () => [] }) }),
        }),
      };
    },
    countDocuments(filter: Record<string, unknown>) {
      countFilter = filter;
      return Promise.resolve(0);
    },
  } as unknown as Model<Provider>;
  const service = new ProvidersService(model);
  const query = Object.assign(new FindProvidersDto(), {
    category: 'espacios',
    status: 'activo',
    search: 'Ana',
  });

  const result = await service.findAll(query, user);
  assert.equal(findFilter.tenantId, user.tenantId);
  assert.equal(findFilter.categoryKeys, 'espacios');
  assert.equal(findFilter.status, 'activo');
  assert.deepEqual(countFilter, findFilter);
  assert.match(
    String((findFilter.$or as Array<{ contactName?: RegExp }>)[1].contactName),
    /Ana/,
  );
  assert.equal(result.pagination.total, 0);
});

test('crear proveedor exige contacto y categorías válidas', async () => {
  const dto = Object.assign(new CreateProviderDto(), {
    name: 'Hacienda El Sol',
    categoryKeys: ['espacios', 'alimentacion'],
    phone: '   ',
  });
  assert.equal(validateSync(dto).length, 0);
  const service = new ProvidersService({
    create: () => assert.fail('No debe guardar'),
  } as unknown as Model<Provider>);
  await assert.rejects(() => service.create(dto, user), /teléfono o un correo/);
  const invalid = Object.assign(new CreateProviderDto(), {
    name: 'Hacienda El Sol',
    categoryKeys: ['invalida'],
    phone: '123',
  });
  assert.ok(validateSync(invalid).length > 0);
});
