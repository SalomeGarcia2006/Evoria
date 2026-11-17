import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type ClientSession, type Model } from 'mongoose';
import { AlertsService } from '../alerts/alerts.service';
import { hasAvailableBudget } from '../budgets/budget-availability';
import { EventBudget } from '../budgets/schemas/event-budget.schema';
import { Event } from '../events/schemas/event.schema';
import { Provider } from '../providers/schemas/provider.schema';
import { EventProviderService } from './schemas/event-provider-service.schema';

/** Called inside the transaction that makes funds available, so a transient
 * increase/release cannot disappear before the periodic worker observes it. */
@Injectable()
export class ProviderServiceFunding {
  constructor(
    @InjectModel(EventProviderService.name)
    private readonly services: Model<EventProviderService>,
    @InjectModel(EventBudget.name) private readonly budgets: Model<EventBudget>,
    @InjectModel(Event.name) private readonly events: Model<Event>,
    @InjectModel(Provider.name) private readonly providers: Model<Provider>,
    private readonly alerts: AlertsService,
  ) {}

  async fundPending(
    tenantId: string,
    eventId: string,
    session: ClientSession,
  ): Promise<void> {
    const event = await this.events.findOneAndUpdate(
      { _id: eventId, tenantId, status: { $ne: 'cancelado' } },
      { $inc: { budgetDecisionRevision: 1 } },
      { session, returnDocument: 'after' },
    );
    if (!event) return;
    const pending = await this.services
      .find({
        tenantId,
        eventId,
        status: 'aceptado_sin_saldo',
        fundingExpiresAt: { $gt: new Date() },
      })
      .sort({ acceptedAt: 1, _id: 1 })
      .session(session);
    for (const service of pending) {
      if (!service.fundingExpiresAt || service.fundingExpiresAt <= new Date())
        continue;
      const validProvider = await this.providers.collection.updateOne(
        {
          _id: service.providerId,
          tenantId: new Types.ObjectId(tenantId),
          status: 'activo',
          email: service.providerEmail,
        },
        { $inc: { serviceDecisionRevision: 1 } },
        { session },
      );
      if (!validProvider.matchedCount) continue;
      const budget = await this.budgets.findOneAndUpdate(
        {
          tenantId,
          eventId,
          $expr: hasAvailableBudget(service.agreedAmountCop),
        },
        { $inc: { providerSpentCop: service.agreedAmountCop } },
        { session, returnDocument: 'after' },
      );
      if (!budget) continue;
      service.status = 'confirmado';
      service.confirmedAt = new Date();
      service.nextCheckAt = null;
      service.notificationRevision = (service.notificationRevision ?? 0) + 1;
      await service.save({ session });
      await this.alerts.providerServiceChanged(
        {
          tenantId,
          eventId,
          recipientId: service.assignedBy.toString(),
          serviceId: service._id.toString(),
          status: service.status,
          revision: service.notificationRevision,
        },
        session,
      );
      await this.alerts.checkBudget(tenantId, eventId, session);
    }
  }
}
