import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditsModule } from '../audits/audits.module';
import { Event, EventSchema } from '../events/schemas/event.schema';
import {
  InventoryItem,
  InventoryItemSchema,
} from '../inventory/schemas/inventory-item.schema';
import {
  EventProviderService,
  EventProviderServiceSchema,
} from '../provider-services/schemas/event-provider-service.schema';
import { Provider, ProviderSchema } from '../providers/schemas/provider.schema';
import {
  EventResource,
  EventResourceSchema,
} from '../resources/schemas/event-resource.schema';
import { BudgetLedgerService } from './budget-ledger.service';
import {
  BudgetOverviewController,
  EventBudgetController,
} from './budgets.controller';
import { BudgetsService } from './budgets.service';
import { EventBudget, EventBudgetSchema } from './schemas/event-budget.schema';

@Module({
  imports: [
    AuditsModule,
    MongooseModule.forFeature([
      { name: EventBudget.name, schema: EventBudgetSchema },
      { name: Event.name, schema: EventSchema },
      { name: EventResource.name, schema: EventResourceSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: EventProviderService.name, schema: EventProviderServiceSchema },
      { name: Provider.name, schema: ProviderSchema },
    ]),
  ],
  controllers: [BudgetOverviewController, EventBudgetController],
  providers: [BudgetLedgerService, BudgetsService],
  exports: [BudgetLedgerService, BudgetsService],
})
export class BudgetsModule {}
