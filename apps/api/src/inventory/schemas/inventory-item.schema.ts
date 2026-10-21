import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import {
  INVENTORY_STATUSES,
  type InventoryStatus,
} from '../inventory.constants';

export type InventoryItemDocument = HydratedDocument<InventoryItem>;

@Schema({ collection: 'resources', timestamps: true, versionKey: false })
export class InventoryItem {
  @Prop({ type: 'ObjectId', ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ required: true, trim: true, minlength: 2, maxlength: 120 })
  name!: string;

  @Prop({
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 80,
    index: true,
  })
  type!: string;

  @Prop({ type: String, trim: true, maxlength: 1000, default: null })
  description!: string | null;

  @Prop({ required: true, min: 0 })
  unitCost!: number;

  @Prop({ required: true, min: 0, default: 0 })
  totalQuantity!: number;

  @Prop({ required: true, min: 0, default: 0 })
  availableQuantity!: number;

  @Prop({ required: true, min: 0, default: 0 })
  reservedQuantity!: number;

  @Prop({
    required: true,
    enum: INVENTORY_STATUSES,
    default: 'disponible',
    index: true,
  })
  status!: InventoryStatus;

  createdAt!: Date;

  updatedAt!: Date;
}

export const InventoryItemSchema = SchemaFactory.createForClass(InventoryItem);
InventoryItemSchema.index({ tenantId: 1, name: 1 });
InventoryItemSchema.index({ tenantId: 1, status: 1 });
