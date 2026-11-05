import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Types } from 'mongoose';

@Schema({ collection: 'alert_conditions', timestamps: true, versionKey: false })
export class AlertCondition {
  @Prop({ type: 'ObjectId', required: true }) tenantId!: Types.ObjectId;
  @Prop({ type: 'ObjectId', required: true }) recipientId!: Types.ObjectId;
  @Prop({ required: true }) key!: string;
  @Prop({ required: true, default: false }) active!: boolean;
  @Prop({ required: true, default: 0 }) generation!: number;
  @Prop({ required: true, default: 0 }) enqueuedGeneration!: number;
  @Prop({ type: Object, required: true }) payload!: Record<string, unknown>;
}
export const AlertConditionSchema =
  SchemaFactory.createForClass(AlertCondition);
AlertConditionSchema.index(
  { tenantId: 1, recipientId: 1, key: 1 },
  { unique: true },
);
AlertConditionSchema.index({ active: 1 });
