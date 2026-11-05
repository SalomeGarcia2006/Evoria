import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditsModule } from '../audits/audits.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import {
  InventoryItem,
  InventoryItemSchema,
} from './schemas/inventory-item.schema';

@Module({
  imports: [
    AuditsModule,
    MongooseModule.forFeature([
      { name: InventoryItem.name, schema: InventoryItemSchema },
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [MongooseModule],
})
export class InventoryModule {}
