import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Types } from 'mongoose';

@Schema({ collection: 'pending_registrations', versionKey: false })
export class PendingRegistration {
  @Prop({ type: 'ObjectId', ref: 'Tenant', required: true })
  tenantId!: Types.ObjectId;

  @Prop({ required: true, unique: true, lowercase: true })
  email!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  lastName!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ required: true })
  codeHash!: string;

  @Prop({ required: true })
  tokenHash!: string;

  @Prop({ type: Number, default: 0 })
  attempts!: number;

  @Prop({ type: Date, required: true, expires: 0 })
  expiresAt!: Date;
}

export const PendingRegistrationSchema =
  SchemaFactory.createForClass(PendingRegistration);
