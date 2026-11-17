import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditsModule } from '../audits/audits.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { Event, EventSchema } from '../events/schemas/event.schema';
import { Provider, ProviderSchema } from '../providers/schemas/provider.schema';
import { ProviderServicesController } from './provider-services.controller';
import { ProviderServicesService } from './provider-services.service';
import { ProviderServiceWorkflow } from './provider-service-workflow.service';
import { ProviderServiceConfirmationController } from './provider-service-confirmation.controller';
import {
  ProviderServiceMail,
  ProviderServiceMailSchema,
} from './schemas/provider-service-mail.schema';
import {
  EventBudget,
  EventBudgetSchema,
} from '../budgets/schemas/event-budget.schema';
import { Tenant, TenantSchema } from '../tenants/schemas/tenant.schema';
import { MailModule } from '../mail/mail.module';
import {
  EventProviderService,
  EventProviderServiceSchema,
} from './schemas/event-provider-service.schema';

@Module({
  imports: [
    AuditsModule,
    BudgetsModule,
    MailModule,
    MongooseModule.forFeature([
      { name: EventProviderService.name, schema: EventProviderServiceSchema },
      { name: Provider.name, schema: ProviderSchema },
      { name: Event.name, schema: EventSchema },
      { name: ProviderServiceMail.name, schema: ProviderServiceMailSchema },
      { name: EventBudget.name, schema: EventBudgetSchema },
      { name: Tenant.name, schema: TenantSchema },
    ]),
  ],
  controllers: [
    ProviderServicesController,
    ProviderServiceConfirmationController,
  ],
  providers: [ProviderServicesService, ProviderServiceWorkflow],
})
export class ProviderServicesModule {}
