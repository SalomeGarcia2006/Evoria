import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
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
  ) {
    await this.reserve(tenantId, eventId, amountCop, 'inventorySpentCop');
  }

  async releaseInventoryCost(
    tenantId: string,
    eventId: string,
    amountCop: number,
  ) {
    await this.release(tenantId, eventId, amountCop, 'inventorySpentCop');
  }

  async reserveProviderCost(
    tenantId: string,
    eventId: string,
    amountCop: number,
  ) {
    await this.reserve(tenantId, eventId, amountCop, 'providerSpentCop');
  }

  async releaseProviderCost(
    tenantId: string,
    eventId: string,
    amountCop: number,
  ) {
    await this.release(tenantId, eventId, amountCop, 'providerSpentCop');
  }

  async hasBudget(tenantId: string, eventId: string): Promise<boolean> {
    return Boolean(await this.budgetModel.exists({ tenantId, eventId }));
  }

  private async reserve(
    tenantId: string,
    eventId: string,
    amountCop: number,
    field: 'inventorySpentCop' | 'providerSpentCop',
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
      { new: true },
    );
    if (budget) return;
    if (!(await this.hasBudget(tenantId, eventId))) {
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
  ) {
    if (amountCop === 0) return;
    const result = await this.budgetModel.updateOne(
      { tenantId, eventId, [field]: { $gte: amountCop } },
      { $inc: { [field]: -amountCop } },
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
