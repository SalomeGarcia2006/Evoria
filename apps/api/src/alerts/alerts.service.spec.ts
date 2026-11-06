import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types, type Model } from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { EventBudget } from '../budgets/schemas/event-budget.schema';
import { Event } from '../events/schemas/event.schema';
import { Membership } from '../memberships/schemas/membership.schema';
import { Permission } from '../permissions/schemas/permission.schema';
import { Profile } from '../profiles/schemas/profile.schema';
import { Alert } from './alert.schema';
import { AlertOutbox } from './alert-outbox.schema';
import { AlertCondition } from './alert-condition.schema';
import { InventoryItem } from '../inventory/schemas/inventory-item.schema';
import { AlertsService } from './alerts.service';

test('el detalle no revela una alerta de otra persona o empresa y respeta la revocación', async () => {
  const tenant = new Types.ObjectId().toString();
  const owner = new Types.ObjectId().toString();
  const id = new Types.ObjectId();
  let active = true;
  const alerts = {
    findOne: (filter: {
      tenantId: string;
      recipientId: string;
      _id: string;
    }) => ({
      lean: async () =>
        filter.tenantId === tenant &&
        filter.recipientId === owner &&
        filter._id === id.toString()
          ? {
              _id: id,
              type: 'budget_decided',
              title: 'Decisión',
              message: 'Decisión disponible',
              severity: 'info',
              eventId: null,
              requestId: null,
              inventoryItemId: null,
              readAt: null,
              createdAt: new Date(),
            }
          : null,
    }),
  } as unknown as Model<Alert>;
  const service = new AlertsService(
    alerts,
    {
      findOne: () => ({
        session: () => ({
          lean: async () =>
            active ? { profileId: new Types.ObjectId() } : null,
        }),
      }),
    } as unknown as Model<Membership>,
    {
      findOne: () => ({
        session: () => ({ lean: async () => ({ permissionIds: [] }) }),
      }),
    } as unknown as Model<Profile>,
    {
      find: () => ({
        session: () => ({
          select: () => ({
            lean: async () =>
              ['alertas.ver', 'eventos.ver', 'presupuestos.ver'].map((key) => ({
                key,
              })),
          }),
        }),
      }),
    } as unknown as Model<Permission>,
    {
      find: () => ({ select: () => ({ lean: async () => [] }) }),
    } as unknown as Model<Event>,
    {
      find: () => ({ select: () => ({ lean: async () => [] }) }),
    } as unknown as Model<EventBudget>,
    {} as Model<AlertOutbox>,
    {} as Model<AlertCondition>,
    {} as Model<InventoryItem>,
  );
  const user = (tenantId: string, userId: string) =>
    ({ id: userId, tenantId, scope: 'tenant' }) as AuthenticatedUser;
  assert.equal(
    (await service.detail(user(tenant, owner), id.toString())).id,
    id.toString(),
  );
  await assert.rejects(
    () =>
      service.detail(
        user(tenant, new Types.ObjectId().toString()),
        id.toString(),
      ),
    NotFoundException,
  );
  await assert.rejects(
    () =>
      service.detail(
        user(new Types.ObjectId().toString(), owner),
        id.toString(),
      ),
    NotFoundException,
  );
  active = false;
  await assert.rejects(
    () => service.detail(user(tenant, owner), id.toString()),
    ForbiddenException,
  );
});
