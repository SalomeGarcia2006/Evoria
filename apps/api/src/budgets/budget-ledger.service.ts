import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';
import { EventBudget } from './schemas/event-budget.schema';

@Injectable()
export class BudgetLedgerService {
  constructor(
    @InjectModel(EventBudget.name)
    private readonly budgetModel: Model<EventBudget>,
  ) {}

  async reserveInventoryCost(
    tenantId: string,
    eventId: string,
    amountCop: number,
    session?: ClientSession,
  ) {
    await this.reserve(
      tenantId,
      eventId,
      amountCop,
      'inventorySpentCop',
      session,
    );
  }

  async releaseInventoryCost(
    tenantId: string,
    eventId: string,
    amountCop: number,
    session?: ClientSession,
  ) {
    await this.release(
      tenantId,
      eventId,
      amountCop,
      'inventorySpentCop',
      session,
    );
  }

  async reserveProviderCost(
    tenantId: string,
    eventId: string,
    amountCop: number,
    session?: ClientSession,
  ) {
    await this.reserve(
      tenantId,
      eventId,
      amountCop,
      'providerSpentCop',
      session,
    );
  }

  async releaseProviderCost(
    tenantId: string,
    eventId: string,
    amountCop: number,
    session?: ClientSession,
  ) {
    await this.release(
      tenantId,
      eventId,
      amountCop,
      'providerSpentCop',
      session,
    );
  }

  async hasBudget(
    tenantId: string,
    eventId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    return Boolean(
      await this.budgetModel
        .exists({ tenantId, eventId })
        .session(session ?? null),
    );
  }

  private async reserve(
    tenantId: string,
    eventId: string,
    amountCop: number,
    field: 'inventorySpentCop' | 'providerSpentCop',
    session?: ClientSession,
  ) {
    if (!Number.isSafeInteger(amountCop) || amountCop < 0) {
      throw new ConflictException(
        'El costo debe ser un monto entero de COP no negativo.',
      );
    }
    const budget = await this.budgetModel.findOneAndUpdate(
      {
        tenantId,
        eventId,
        ...(amountCop > 0 ? { $expr: this.hasAvailable(amountCop) } : {}),
      },
      { $inc: { [field]: amountCop } },
      { new: true, session },
    );
    if (budget) return;
    if (!(await this.hasBudget(tenantId, eventId, session))) {
      throw new ConflictException(
        'El evento aún no tiene presupuesto inicial.',
      );
    }
    throw new ConflictException(
      'El costo supera el presupuesto disponible del evento.',
    );
  }

  private async release(
    tenantId: string,
    eventId: string,
    amountCop: number,
    field: 'inventorySpentCop' | 'providerSpentCop',
    session?: ClientSession,
  ) {
    if (amountCop === 0) return;
    const result = await this.budgetModel.updateOne(
      { tenantId, eventId, [field]: { $gte: amountCop } },
      { $inc: { [field]: -amountCop } },
      { session },
    );
    if (result.matchedCount !== 1) {
      throw new ConflictException(
        'No se pudo ajustar el gasto registrado en el presupuesto.',
      );
    }
  }

  hasAvailable(amountCop: number) {
    return {
      $gte: [
        {
          $subtract: [
            { $add: ['$baseAmountCop', '$approvedIncreaseCop'] },
            {
              $add: [
                '$inventorySpentCop',
                '$providerSpentCop',
                '$extraSpentCop',
              ],
            },
          ],
        },
        amountCop,
      ],
    };
  }
}
