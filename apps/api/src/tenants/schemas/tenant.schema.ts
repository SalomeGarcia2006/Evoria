import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import { TENANT_STATUSES, type TenantStatus } from '../tenants.constants';

export type TenantDocument = HydratedDocument<Tenant>;

@Schema({ collection: 'tenants', timestamps: true, versionKey: false })
export class Tenant {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 120 })
  name!: string;

  @Prop({ required: true, trim: true, minlength: 3, maxlength: 30 })
  nit!: string;

  @Prop({
    required: true,
    unique: true,
    index: true,
    trim: true,
    lowercase: true,
    match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  })
  slug!: string;

  @Prop({ type: 'ObjectId', ref: 'User', default: null })
  createdBy!: Types.ObjectId | null;

  @Prop({
    required: true,
    enum: TENANT_STATUSES,
    default: 'activo',
    index: true,
  })
  status!: TenantStatus;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);
TenantSchema.index(
  { nit: 1 },
  { unique: true, partialFilterExpression: { nit: { $exists: true } } },
);
