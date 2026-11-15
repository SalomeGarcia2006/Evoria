import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Types, type Model } from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditsService } from '../audits/audits.service';
import { BudgetsService } from '../budgets/budgets.service';
import { Membership } from '../memberships/schemas/membership.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Event, EventSchema } from './schemas/event.schema';
import { model } from 'mongoose';
import { EventsService } from './events.service';

const tenantId = new Types.ObjectId().toString();
const user = {
  id: new Types.ObjectId().toString(),
  scope: 'tenant',
  tenantId,
} as AuthenticatedUser;
const audits = { record: async () => undefined } as unknown as AuditsService;

function eventDto(baseBudget: number) {
  return plainToInstance(CreateEventDto, {
    name: 'Evento de prueba',
    startAt: '2026-12-05T15:00:00.000Z',
    endAt: '2026-12-06T02:00:00.000Z',
    baseBudget,
  });
}

test('el presupuesto base es obligatorio y se valida como COP entero', () => {
  assert.ok(validateSync(eventDto(9000000)).length === 0);
  assert.ok(validateSync(eventDto(100.5)).length > 0);
  assert.ok(validateSync(eventDto(-1)).length > 0);
  assert.ok(
    validateSync(
      plainToInstance(CreateEventDto, {
        name: 'Evento de prueba',
        startAt: '2026-12-05T15:00:00.000Z',
        endAt: '2026-12-06T02:00:00.000Z',
      }),
    ).length > 0,
  );
});

test('invitados admite enteros no negativos y es opcional al crear y editar', async () => {
  for (const dto of [CreateEventDto, UpdateEventDto]) {
    const base = dto === CreateEventDto ? eventDto(100) : {};
    for (const value of [0, 25]) {
      assert.equal(
        validateSync(plainToInstance(dto, { ...base, invitados: value }))
          .length,
        0,
      );
    }
    for (const value of [-1, 1.5, null, Number.MAX_SAFE_INTEGER + 1]) {
      assert.ok(
        validateSync(plainToInstance(dto, { ...base, invitados: value }))
          .length > 0,
      );
    }
    assert.equal(validateSync(plainToInstance(dto, base)).length, 0);
  }
  const eventModel = model('EventInvitadosValidation', EventSchema);
  await assert.rejects(
    new eventModel({ invitados: 1.5 }).validate(),
    (error: { errors: Record<string, unknown> }) =>
      Boolean(error.errors.invitados),
  );
});

test('crear un evento inicia su presupuesto con el mismo monto', async () => {
  const eventId = new Types.ObjectId();
  let initialized: unknown[] = [];
  let deleted = false;
  const eventModel = {
    create: async (data: Record<string, unknown>) => ({
      ...data,
      _id: eventId,
      startAt: data.startAt,
      endAt: data.endAt,
      createdBy: new Types.ObjectId(user.id),
      createdAt: new Date(),
      updatedAt: new Date(),
      deleteOne: async () => {
        deleted = true;
      },
    }),
  } as unknown as Model<Event>;
  const budgets = {
    initializeForEvent: async (...args: unknown[]) => {
      initialized = args;
    },
  } as unknown as BudgetsService;
  const service = new EventsService(
    eventModel,
    {} as Model<Membership>,
    budgets,
    audits,
  );

  const result = await service.create(
    { ...eventDto(9000000), invitados: 35 },
    user,
  );

  assert.equal(result.baseBudget, 9000000);
  assert.equal(result.invitados, 35);
  assert.deepEqual(initialized, [
    eventId.toString(),
    tenantId,
    9000000,
    user.id,
  ]);
  assert.equal(deleted, false);
});

test('editar y consultar un evento conserva la cantidad de invitados', async () => {
  const event = {
    _id: new Types.ObjectId(),
    name: 'Evento',
    status: 'borrador',
    invitados: 4,
    startAt: new Date('2026-12-05T15:00:00.000Z'),
    endAt: new Date('2026-12-06T02:00:00.000Z'),
    createdBy: new Types.ObjectId(user.id),
    save: async () => undefined,
  };
  const service = new EventsService(
    { findOne: async () => event } as unknown as Model<Event>,
    {} as Model<Membership>,
    {} as BudgetsService,
    audits,
  );
  const updated = await service.update(
    event._id.toString(),
    { invitados: 20 },
    user,
  );
  assert.equal(updated.invitados, 20);
  assert.equal(
    (await service.findOne(event._id.toString(), user)).invitados,
    20,
  );
});

test('si falla la inicialización, se retira el evento creado', async () => {
  let deleted = false;
  const eventModel = {
    create: async () => ({
      _id: new Types.ObjectId(),
      deleteOne: async () => {
        deleted = true;
      },
    }),
  } as unknown as Model<Event>;
  const budgets = {
    initializeForEvent: async () => {
      throw new Error('No se pudo iniciar el presupuesto');
    },
  } as unknown as BudgetsService;
  const service = new EventsService(
    eventModel,
    {} as Model<Membership>,
    budgets,
    audits,
  );

  await assert.rejects(() => service.create(eventDto(9000000), user));
  assert.equal(deleted, true);
});

test('una confirmación incierta no borra el evento que puede tener presupuesto', async () => {
  let deleted = false;
  const eventModel = {
    create: async () => ({
      _id: new Types.ObjectId(),
      deleteOne: async () => {
        deleted = true;
      },
    }),
  } as unknown as Model<Event>;
  const budgets = {
    initializeForEvent: async () => {
      throw {
        hasErrorLabel: (label: string) =>
          label === 'UnknownTransactionCommitResult',
      };
    },
  } as unknown as BudgetsService;
  const service = new EventsService(
    eventModel,
    {} as Model<Membership>,
    budgets,
    audits,
  );
  await assert.rejects(() => service.create(eventDto(9000000), user));
  assert.equal(deleted, false);
});

test('editar un evento no permite cambiar el presupuesto base sin autorización', async () => {
  let saves = 0;
  const event = {
    status: 'borrador',
    baseBudget: 9000000,
    startAt: new Date('2026-12-05T15:00:00.000Z'),
    endAt: new Date('2026-12-06T02:00:00.000Z'),
    save: async () => {
      saves += 1;
    },
  };
  const eventModel = {
    findOne: async () => event,
  } as unknown as Model<Event>;
  const service = new EventsService(
    eventModel,
    {} as Model<Membership>,
    {} as BudgetsService,
    audits,
  );

  for (const baseBudget of [10000000, 100]) {
    await assert.rejects(
      () =>
        service.update(
          new Types.ObjectId().toString(),
          { baseBudget, name: 'Nombre nuevo' },
          user,
        ),
      ConflictException,
    );
  }
  assert.equal(event.baseBudget, 9000000);
  assert.equal(saves, 0);
});

test('un nombre inválido no guarda el evento ni cambia su presupuesto', async () => {
  let saves = 0;
  const event = {
    status: 'borrador',
    baseBudget: 9000000,
    name: 'Nombre original',
    startAt: new Date('2026-12-05T15:00:00.000Z'),
    endAt: new Date('2026-12-06T02:00:00.000Z'),
    save: async () => {
      saves += 1;
    },
  };
  const service = new EventsService(
    { findOne: async () => event } as unknown as Model<Event>,
    {} as Model<Membership>,
    {} as BudgetsService,
    audits,
  );

  await assert.rejects(
    () =>
      service.update(
        new Types.ObjectId().toString(),
        { name: '  ', baseBudget: 10000000 },
        user,
      ),
    BadRequestException,
  );
  assert.equal(event.name, 'Nombre original');
  assert.equal(event.baseBudget, 9000000);
  assert.equal(saves, 0);
});

test('un fallo al guardar el evento no deja cambios en el presupuesto', async () => {
  const event = {
    status: 'borrador',
    baseBudget: 9000000,
    name: 'Nombre original',
    startAt: new Date('2026-12-05T15:00:00.000Z'),
    endAt: new Date('2026-12-06T02:00:00.000Z'),
    save: async () => {
      throw new Error('Falló el guardado');
    },
  };
  const service = new EventsService(
    { findOne: async () => event } as unknown as Model<Event>,
    {} as Model<Membership>,
    {} as BudgetsService,
    audits,
  );

  await assert.rejects(() =>
    service.update(
      new Types.ObjectId().toString(),
      { name: 'Nombre nuevo', baseBudget: 9000000 },
      user,
    ),
  );
  assert.equal(event.baseBudget, 9000000);
});
