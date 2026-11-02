import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateSync } from 'class-validator';
import { Types, type Model } from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Event } from '../events/schemas/event.schema';
import { Provider } from '../providers/schemas/provider.schema';
import { CreateProviderServiceDto } from './dto/create-provider-service.dto';
import { ProviderServicesService } from './provider-services.service';
import { EventProviderService } from './schemas/event-provider-service.schema';

const eventId = new Types.ObjectId();
const providerId = new Types.ObjectId();
const user = {
  id: new Types.ObjectId().toString(),
  scope: 'tenant',
  tenantId: new Types.ObjectId().toString(),
} as AuthenticatedUser;

function setup(eventStatus = 'confirmado', providerStatus = 'activo') {
  const created: Array<Record<string, unknown>> = [];
  const eventModel = {
    findOne: async (filter: Record<string, unknown>) => {
      assert.equal(filter.tenantId, user.tenantId);
      return { status: eventStatus };
    },
  } as unknown as Model<Event>;
  const provider = {
    _id: providerId,
    name: 'Hacienda El Sol',
    categoryKeys: ['espacios'],
    status: providerStatus,
  };
  const providerModel = {
    findOne: async (filter: Record<string, unknown>) => {
      assert.equal(filter.tenantId, user.tenantId);
      return filter._id === providerId.toString() ? provider : null;
    },
  } as unknown as Model<Provider>;
  const serviceModel = {
    create: async (data: Record<string, unknown>) => {
      created.push(data);
      return {
        ...data,
        _id: new Types.ObjectId(),
        eventId,
        providerId,
        assignedBy: new Types.ObjectId(user.id),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
  } as unknown as Model<EventProviderService>;
  return {
    created,
    service: new ProviderServicesService(
      serviceModel,
      providerModel,
      eventModel,
    ),
  };
}

function request(): CreateProviderServiceDto {
  return Object.assign(new CreateProviderServiceDto(), {
    providerId: providerId.toString(),
    serviceName: 'Cena principal',
    startDate: '2026-12-05',
    agreedAmountCop: 3200000,
  });
}

test('permite dos acuerdos independientes del mismo proveedor y empresa', async () => {
  const { service, created } = setup();
  const first = await service.create(eventId.toString(), request(), user);
  const second = await service.create(
    eventId.toString(),
    {
      ...request(),
      serviceName: 'Alquiler de hacienda',
      startDate: '2026-12-04',
      agreedAmountCop: 5000000,
    },
    user,
  );
  assert.notEqual(first.id, second.id);
  assert.equal(created.length, 2);
  assert.ok(created.every((item) => item.tenantId === user.tenantId));
  assert.equal(second.providerId, first.providerId);
  assert.equal(first.agreedAmountCop, 3200000);
});

test('impide nuevas asignaciones con evento cancelado o proveedor inactivo', async () => {
  await assert.rejects(
    () =>
      setup('cancelado').service.create(eventId.toString(), request(), user),
    /evento cancelado/,
  );
  await assert.rejects(
    () =>
      setup('confirmado', 'inactivo').service.create(
        eventId.toString(),
        request(),
        user,
      ),
    /proveedor inactivo/,
  );
});

test('rechaza fechas inexistentes, fin anterior y montos no positivos', async () => {
  const { service } = setup();
  await assert.rejects(
    () =>
      service.create(
        eventId.toString(),
        { ...request(), startDate: '2026-02-30' },
        user,
      ),
    /fechas de calendario válidas/,
  );
  await assert.rejects(
    () =>
      service.create(
        eventId.toString(),
        { ...request(), endDate: '2026-12-04' },
        user,
      ),
    /anterior al inicio/,
  );
  const dto = Object.assign(request(), { agreedAmountCop: 0 });
  assert.ok(validateSync(dto).length > 0);
});

test('consulta el historial de un evento cancelado con proveedor inactivo', async () => {
  let filter: Record<string, unknown> = {};
  const eventModel = {
    findOne: async () => ({ status: 'cancelado' }),
  } as unknown as Model<Event>;
  const serviceModel = {
    find(query: Record<string, unknown>) {
      filter = query;
      return {
        sort: () => ({
          lean: async () => [
            {
              _id: new Types.ObjectId(),
              eventId,
              providerId,
              serviceName: 'Cena principal',
              description: null,
              startDate: '2026-12-05',
              startTime: null,
              endDate: null,
              endTime: null,
              agreedAmountCop: 3200000,
              status: 'cancelado',
              assignedBy: new Types.ObjectId(user.id),
              createdAt: new Date(),
              updatedAt: new Date(),
              cancelledAt: new Date(),
            },
          ],
        }),
      };
    },
  } as unknown as Model<EventProviderService>;
  const providerModel = {
    find: () => ({
      lean: async () => [
        {
          _id: providerId,
          name: 'Hacienda El Sol',
          categoryKeys: ['espacios'],
          status: 'inactivo',
        },
      ],
    }),
  } as unknown as Model<Provider>;
  const service = new ProviderServicesService(
    serviceModel,
    providerModel,
    eventModel,
  );

  const items = await service.findAll(
    eventId.toString(),
    { includeCancelled: true },
    user,
  );
  assert.equal(filter.tenantId, user.tenantId);
  assert.equal(filter.status, undefined);
  assert.equal(items[0].status, 'cancelado');
  assert.equal(items[0].provider.status, 'inactivo');
});
