import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { model, type Model } from 'mongoose';
import { BadRequestException } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventClientDto } from './dto/event-client.dto';
import { Event, EventSchema } from './schemas/event.schema';
import { EventsService } from './events.service';
import type { Membership } from '../memberships/schemas/membership.schema';
import type { BudgetsService } from '../budgets/budgets.service';
import type { AuditsService } from '../audits/audits.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { eventClientFixture } from '../testing/event-client.fixture';

const base = {
  name: 'Evento',
  startAt: '2030-01-10T10:00:00Z',
  endAt: '2030-01-10T18:00:00Z',
  baseBudget: 1000,
};

test('el cliente se valida completo, conserva identificación textual y normaliza espacios y correo', () => {
  const client = plainToInstance(
    EventClientDto,
    eventClientFixture({
      name: '  María López  ',
      identification: '  00123-A  ',
      phone: ' +57 (300) 123-4567 ',
      address: '  Calle 20 # 1-30  ',
      email: '  CLIENTE@EXAMPLE.TEST  ',
    }),
  );
  assert.equal(validateSync(client).length, 0);
  assert.equal(client.name, 'María López');
  assert.equal(client.identification, '00123-A');
  assert.equal(client.phone, '+57 (300) 123-4567');
  assert.equal(client.address, 'Calle 20 # 1-30');
  assert.equal(client.email, 'cliente@example.test');
  assert.equal(
    validateSync(plainToInstance(CreateEventDto, { ...base, client })).length,
    0,
  );
  for (const field of ['name', 'identification', 'phone', 'address', 'email']) {
    const missing: Record<string, unknown> = { ...client };
    delete missing[field];
    for (const dto of [CreateEventDto, UpdateEventDto])
      assert.ok(
        validateSync(plainToInstance(dto, { ...base, client: missing }))
          .length > 0,
        field,
      );
  }
});

test('crear exige cliente; editar permite omitirlo pero rechaza null, fragmentos y formatos inválidos', () => {
  assert.ok(validateSync(plainToInstance(CreateEventDto, base)).length > 0);
  assert.equal(
    validateSync(plainToInstance(UpdateEventDto, { name: 'Otro nombre' }))
      .length,
    0,
  );
  const invalid = [
    null,
    [],
    'cliente',
    {},
    eventClientFixture({ name: '  ' }),
    eventClientFixture({ identification: '' }),
    { ...eventClientFixture(), identification: 123456 },
    eventClientFixture({ phone: 'llamar mañana' }),
    eventClientFixture({ phone: '123' }),
    eventClientFixture({ phone: '1234567890123456' }),
    eventClientFixture({ address: ' ' }),
    eventClientFixture({ email: 'sin-correo' }),
    eventClientFixture({ name: 'a'.repeat(161) }),
    eventClientFixture({ address: 'a'.repeat(256) }),
    eventClientFixture({ identification: 'a'.repeat(51) }),
  ];
  for (const client of invalid)
    for (const dto of [CreateEventDto, UpdateEventDto])
      assert.ok(
        validateSync(plainToInstance(dto, { ...base, client })).length > 0,
        JSON.stringify(client),
      );
});

test('el esquema valida los campos del cliente sin exigir datos inventados a eventos históricos', async () => {
  const eventModel = model('EventClientValidation', EventSchema);
  const values = {
    tenantId: '64a000000000000000000001',
    createdBy: '64a000000000000000000002',
    ...base,
  };
  const historical = new eventModel(values);
  await historical.validate();
  assert.equal(historical.client, null);
  const current = new eventModel({
    ...values,
    client: eventClientFixture({ email: ' CLIENTE@EXAMPLE.TEST ' }),
  });
  await current.validate();
  assert.equal(current.client?.email, 'cliente@example.test');
  assert.equal('_id' in current.client!, false);
  for (const client of [
    { name: 'Cliente' },
    eventClientFixture({ email: 'inválido' }),
    eventClientFixture({ phone: 'abc12345' }),
  ])
    await assert.rejects(() =>
      new eventModel({ ...values, client }).validate(),
    );
});

test('una llamada interna con cliente inválido no guarda evento ni inicializa presupuesto', async () => {
  let writes = 0;
  const service = new EventsService(
    {
      create: async () => {
        writes++;
      },
    } as unknown as Model<Event>,
    {} as Model<Membership>,
    {
      initializeForEvent: async () => {
        writes++;
      },
    } as unknown as BudgetsService,
    {} as AuditsService,
  );
  const user = {
    id: '64a000000000000000000001',
    tenantId: '64a000000000000000000002',
    scope: 'tenant',
  } as AuthenticatedUser;
  for (const client of [
    undefined,
    null,
    { ...eventClientFixture(), email: 'mal' },
  ])
    await assert.rejects(
      () => service.create({ ...base, client } as CreateEventDto, user),
      BadRequestException,
    );
  assert.equal(writes, 0);
});
