import {
  PROVIDER_CATEGORIES,
  PROVIDER_STATUSES,
  type ProviderCategory,
  type ProviderStatus,
} from '../providers.constants';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';

export type ProviderDocument = HydratedDocument<Provider>;

@Schema({ collection: 'providers', timestamps: true, versionKey: false })
export class Provider {
  @Prop({ type: 'ObjectId', ref: 'Tenant', required: true })
  tenantId!: Types.ObjectId;

  @Prop({ required: true, trim: true, minlength: 2, maxlength: 120 })
  name!: string;

  @Prop({ type: [String], required: true, enum: PROVIDER_CATEGORIES })
  categoryKeys!: ProviderCategory[];

  @Prop({ type: String, trim: true, maxlength: 120, default: null })
  contactName!: string | null;

  @Prop({ type: String, trim: true, maxlength: 40, default: null })
  phone!: string | null;

  @Prop({ type: String, trim: true, maxlength: 254, default: null })
  email!: string | null;

  @Prop({ type: String, trim: true, maxlength: 255, default: null })
  location!: string | null;

  @Prop({ type: String, trim: true, maxlength: 1000, default: null })
  notes!: string | null;

  @Prop({ required: true, enum: PROVIDER_STATUSES, default: 'activo' })
  status!: ProviderStatus;

  @Prop({ type: 'ObjectId', ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ProviderSchema = SchemaFactory.createForClass(Provider);
ProviderSchema.index({ tenantId: 1, name: 1 });
ProviderSchema.index({ tenantId: 1, categoryKeys: 1, status: 1 });
