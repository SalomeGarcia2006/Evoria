import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types, type Model } from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Event } from '../events/schemas/event.schema';
import { EventsService } from '../events/events.service';
import { Membership } from '../memberships/schemas/membership.schema';
import { InventoryItem } from '../inventory/schemas/inventory-item.schema';
import { EventProviderService } from '../provider-services/schemas/event-provider-service.schema';
import { Provider } from '../providers/schemas/provider.schema';
import { EventResource } from '../resources/schemas/event-resource.schema';
import { BudgetLedgerService } from './budget-ledger.service';
import { BudgetsService } from './budgets.service';
import { EventBudget } from './schemas/event-budget.schema';

test('una decisión bloquea un cambio concurrente de responsable o cancelación', async () => {
  const tenantId = new Types.ObjectId().toString();
  const eventId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();
  const requestId = new Types.ObjectId();
  const requester = new Types.ObjectId();
  const user = { id: userId, tenantId, scope: 'tenant' } as AuthenticatedUser;
  let lock: string | undefined;
  let enterDecision!: () => void;
  let finishDecision!: () => void;
  const entered = new Promise<void>((resolve) => {
    enterDecision = resolve;
  });
  const resume = new Promise<void>((resolve) => {
    finishDecision = resolve;
  });
  const eventModel = {
    findOneAndUpdate: async (
      _filter: unknown,
      update: { $set: { budgetDecisionLock: string } },
    ) => {
      if (lock) return null;
      lock = update.$set.budgetDecisionLock;
      return { _id: eventId };
    },
    findOne: async () => ({
      status: 'planificado',
      responsibleUserId: userId,
      startAt: new Date('2026-12-01T00:00:00Z'),
      endAt: new Date('2026-12-02T00:00:00Z'),
      set: () => undefined,
      save: async function (this: { $where?: unknown }) {
        assert.ok(this.$where, 'la escritura debe comprobar el bloqueo');
        if (lock) throw new Error('El evento está bloqueado');
      },
    }),
    updateOne: async () => {
      lock = undefined;
    },
  } as unknown as Model<Event>;
  const request = {
    _id: requestId,
    type: 'ampliacion',
    amountCop: 100,
    reason: 'Motivo válido',
    status: 'pendiente',
    requestedBy: requester,
    requestedAt: new Date(),
    decidedBy: null,
    decidedAt: null,
    rejectionReason: null,
  };
  const budgetModel = {
    findOne: async () => ({ requests: [request] }),
    findOneAndUpdate: async () => {
      enterDecision();
      await resume;
      return { requests: [{ ...request, status: 'aprobada' }] };
    },
  } as unknown as Model<EventBudget>;
  const service = new BudgetsService(
    budgetModel,
    eventModel,
    {} as Model<EventResource>,
    {} as Model<InventoryItem>,
    {} as Model<EventProviderService>,
    {} as Model<Provider>,
    {} as BudgetLedgerService,
  );
  const events = new EventsService(
    eventModel,
    { exists: async () => true } as unknown as Model<Membership>,
    service,
  );
  const pending = service.approve(eventId, requestId.toString(), user);
  await entered;
  assert.ok(lock, 'el evento debe permanecer bloqueado durante la decisión');
  await assert.rejects(() =>
    events.update(
      eventId,
      { responsibleUserId: new Types.ObjectId().toString() },
      user,
    ),
  );
  await assert.rejects(() => events.cancel(eventId, user));
  finishDecision();
  assert.equal((await pending).status, 'aprobada');
  assert.equal(lock, undefined);
});
