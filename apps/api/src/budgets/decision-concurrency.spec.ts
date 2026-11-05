import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types, type Model } from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { Event } from '../events/schemas/event.schema';
import type { InventoryItem } from '../inventory/schemas/inventory-item.schema';
import type { EventProviderService } from '../provider-services/schemas/event-provider-service.schema';
import type { Provider } from '../providers/schemas/provider.schema';
import type { EventResource } from '../resources/schemas/event-resource.schema';
import type { AuditsService } from '../audits/audits.service';
import type { BudgetLedgerService } from './budget-ledger.service';
import { BudgetsService } from './budgets.service';
import type { EventBudget } from './schemas/event-budget.schema';

test('la decisión escribe el evento y el presupuesto con la misma sesión', async () => {
  const tenantId = new Types.ObjectId().toString();
  const eventId = new Types.ObjectId().toString();
  const user = {
    id: new Types.ObjectId().toString(),
    tenantId,
    scope: 'tenant',
  } as AuthenticatedUser;
  const request = {
    _id: new Types.ObjectId(),
    type: 'ampliacion',
    amountCop: 100,
    reason: 'Motivo válido',
    status: 'pendiente',
    requestedBy: new Types.ObjectId(),
    requestedAt: new Date(),
    decidedBy: null,
    decidedAt: null,
    rejectionReason: null,
  };
  const session = {
    withTransaction: async (fn: () => Promise<unknown>) => fn(),
    endSession: async () => undefined,
  };
  let guardWritten = false;
  const eventModel = {
    db: { startSession: async () => session },
    findOneAndUpdate: async (
      filter: Record<string, unknown>,
      update: { $inc: { budgetDecisionRevision: number } },
      options: { session: unknown },
    ) => {
      assert.equal(filter.responsibleUserId, user.id);
      assert.equal(update.$inc.budgetDecisionRevision, 1);
      assert.equal(options.session, session);
      guardWritten = true;
      return { _id: eventId };
    },
    findOne: () => ({
      session: async (actual: unknown) => {
        assert.equal(actual, session);
        return { status: 'confirmado', responsibleUserId: user.id };
      },
    }),
  } as unknown as Model<Event>;
  const budgetModel = {
    findOne: () => ({
      session: async (actual: unknown) => {
        assert.equal(actual, session);
        return { requests: [request] };
      },
    }),
    findOneAndUpdate: async (
      _filter: unknown,
      _update: unknown,
      options: { session: unknown },
    ) => {
      assert.ok(guardWritten);
      assert.equal(options.session, session);
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
    { record: async () => undefined } as unknown as AuditsService,
  );
  assert.equal(
    (await service.approve(eventId, request._id.toString(), user)).status,
    'aprobada',
  );
});
