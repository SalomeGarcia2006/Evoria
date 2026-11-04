import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditsModule } from '../audits/audits.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { Event, EventSchema } from '../events/schemas/event.schema';
import { Provider, ProviderSchema } from '../providers/schemas/provider.schema';
import { ProviderServicesController } from './provider-services.controller';
import { ProviderServicesService } from './provider-services.service';
import {
  EventProviderService,
  EventProviderServiceSchema,
} from './schemas/event-provider-service.schema';

@Module({
  imports: [
    AuditsModule,
    BudgetsModule,
    MongooseModule.forFeature([
      { name: EventProviderService.name, schema: EventProviderServiceSchema },
      { name: Provider.name, schema: ProviderSchema },
      { name: Event.name, schema: EventSchema },
    ]),
  ],
  controllers: [ProviderServicesController],
  providers: [ProviderServicesService],
})
export class ProviderServicesModule {}
