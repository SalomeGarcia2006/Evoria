import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import { RESOURCE_STATUSES, type ResourceStatus } from '../resources.constants';

export type ResourceDocument = HydratedDocument<Resource>;

@Schema({ collection: 'resources', timestamps: true, versionKey: false })
export class Resource {
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
    enum: RESOURCE_STATUSES,
    default: 'disponible',
    index: true,
  })
  status!: ResourceStatus;

  createdAt!: Date;

  updatedAt!: Date;
}

export const ResourceSchema = SchemaFactory.createForClass(Resource);
ResourceSchema.index({ tenantId: 1, name: 1 });
ResourceSchema.index({ tenantId: 1, status: 1 });
