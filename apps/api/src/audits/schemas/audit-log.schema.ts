import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({
  collection: 'audit_logs',
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
})
export class AuditLog {
  @Prop({ type: 'ObjectId', ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: 'ObjectId', ref: 'User', required: true, index: true })
  actorUserId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120 })
  actorName!: string;

  @Prop({ required: true, trim: true, lowercase: true, maxlength: 80 })
  module!: string;

  @Prop({ required: true, trim: true, lowercase: true, maxlength: 80 })
  action!: string;

  @Prop({ required: true, trim: true, lowercase: true, maxlength: 80 })
  entity!: string;

  @Prop({ type: 'ObjectId', required: true, index: true })
  entityId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 500 })
  description!: string;

  createdAt!: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ tenantId: 1, createdAt: -1 });
AuditLogSchema.index({ tenantId: 1, module: 1, action: 1, createdAt: -1 });
