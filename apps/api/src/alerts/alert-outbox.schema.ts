import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Types } from 'mongoose';

@Schema({ collection: 'alert_outbox', timestamps: true, versionKey: false })
export class AlertOutbox {
  @Prop({ type: 'ObjectId', required: true }) tenantId!: Types.ObjectId;
  @Prop({ type: 'ObjectId', required: true }) recipientId!: Types.ObjectId;
  @Prop({ required: true }) dedupeKey!: string;
  @Prop({ type: Object, required: true }) payload!: Record<string, unknown>;
  @Prop({ type: Date, default: null }) deliveredAt!: Date | null;
  @Prop({ type: Date, required: true, default: Date.now }) nextAttemptAt!: Date;
  @Prop({ type: Number, default: 0 }) attempts!: number;
}
export const AlertOutboxSchema = SchemaFactory.createForClass(AlertOutbox);
AlertOutboxSchema.index(
  { tenantId: 1, recipientId: 1, dedupeKey: 1 },
  { unique: true },
);
AlertOutboxSchema.index({ deliveredAt: 1, nextAttemptAt: 1 });
