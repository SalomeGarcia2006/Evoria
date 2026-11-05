import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Types } from 'mongoose';

@Schema({ collection: 'alerts', timestamps: true, versionKey: false })
export class Alert {
  @Prop({ type: 'ObjectId', required: true }) tenantId!: Types.ObjectId;
  @Prop({ type: 'ObjectId', required: true }) recipientId!: Types.ObjectId;
  @Prop({ required: true }) type!: string;
  @Prop({ required: true }) title!: string;
  @Prop({ required: true }) message!: string;
  @Prop({ required: true, enum: ['info', 'warning'] }) severity!: string;
  @Prop({ type: 'ObjectId', default: null }) eventId!: Types.ObjectId | null;
  @Prop({ type: 'ObjectId', default: null }) requestId!: Types.ObjectId | null;
  @Prop({ type: 'ObjectId', default: null })
  inventoryItemId!: Types.ObjectId | null;
  @Prop({ required: true }) dedupeKey!: string;
  @Prop({ type: Date, default: null }) readAt!: Date | null;
  createdAt!: Date;
}
export const AlertSchema = SchemaFactory.createForClass(Alert);
AlertSchema.index(
  { tenantId: 1, recipientId: 1, dedupeKey: 1 },
  { unique: true },
);
AlertSchema.index({
  tenantId: 1,
  recipientId: 1,
  readAt: 1,
  createdAt: -1,
  _id: -1,
});
