import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import { EVENT_STATUSES, type EventStatus } from '../events.constants';

export type EventDocument = HydratedDocument<Event>;

@Schema({ collection: 'events', timestamps: true, versionKey: false })
export class Event {
  @Prop({ type: 'ObjectId', ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ required: true, trim: true, minlength: 2, maxlength: 120 })
  name!: string;

  @Prop({ type: String, trim: true, maxlength: 1000, default: null })
  description!: string | null;

  @Prop({ type: Date, required: true, index: true })
  startAt!: Date;

  @Prop({ type: Date, required: true, index: true })
  endAt!: Date;

  @Prop({ type: String, trim: true, maxlength: 255, default: null })
  location!: string | null;

  @Prop({ type: String, trim: true, maxlength: 80, default: null })
  type!: string | null;

  @Prop({
    required: true,
    enum: EVENT_STATUSES,
    default: 'borrador',
    index: true,
  })
  status!: EventStatus;

  @Prop({ type: 'ObjectId', ref: 'User', default: null, index: true })
  responsibleUserId!: Types.ObjectId | null;

  @Prop({ type: 'ObjectId', ref: 'User', required: true, index: true })
  createdBy!: Types.ObjectId;

  createdAt!: Date;

  updatedAt!: Date;
}

export const EventSchema = SchemaFactory.createForClass(Event);
EventSchema.index({ tenantId: 1, startAt: 1 });
EventSchema.index({ tenantId: 1, status: 1 });
