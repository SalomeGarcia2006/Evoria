import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import {
  TENANT_OPERATION_MODES,
  TENANT_STATUSES,
  type TenantOperationMode,
  type TenantStatus,
} from '../tenants.constants';

@Schema({ _id: false })
export class TenantOperationalArea {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 80 })
  name!: string;

  @Prop({ type: String, trim: true, maxlength: 500, default: null })
  description!: string | null;

  @Prop({ type: [String], default: [] })
  responsibilities!: string[];

  @Prop({ type: [String], default: [] })
  authorizations!: string[];
}

export const TenantOperationalAreaSchema = SchemaFactory.createForClass(
  TenantOperationalArea,
);

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

  @Prop({ type: String, trim: true, maxlength: 80, default: null })
  sector!: string | null;

  @Prop({ type: String, trim: true, maxlength: 1500, default: null })
  operationalDescription!: string | null;

  @Prop({ type: [String], default: undefined })
  eventTypes!: string[] | undefined;

  @Prop({ type: String, enum: TENANT_OPERATION_MODES, default: null })
  operationMode!: TenantOperationMode | null;

  @Prop({ type: [TenantOperationalAreaSchema], default: undefined })
  operationalAreas!: TenantOperationalArea[] | undefined;

  @Prop({ type: String, trim: true, maxlength: 2000, default: null })
  operationalNotes!: string | null;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);
TenantSchema.index(
  { nit: 1 },
  { unique: true, partialFilterExpression: { nit: { $exists: true } } },
);
