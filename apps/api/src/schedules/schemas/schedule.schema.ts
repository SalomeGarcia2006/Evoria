import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import { SCHEDULE_STATUSES, type ScheduleStatus } from '../schedules.constants';

export type ScheduleDocument = HydratedDocument<Schedule>;

@Schema({ collection: 'schedules', timestamps: true, versionKey: false })
export class Schedule {
  @Prop({ type: 'ObjectId', ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: 'ObjectId', ref: 'Event', required: true, index: true })
  eventId!: Types.ObjectId;

  @Prop({ type: 'ObjectId', ref: 'User', default: null, index: true })
  responsibleUserId!: Types.ObjectId | null;

  @Prop({ required: true, trim: true, minlength: 2, maxlength: 120 })
  name!: string;

  @Prop({ type: String, trim: true, maxlength: 1000, default: null })
  description!: string | null;

  @Prop({ type: Date, required: true, index: true })
  startAt!: Date;

  @Prop({ type: Date, required: true, index: true })
  endAt!: Date;

  @Prop({
    required: true,
    enum: SCHEDULE_STATUSES,
    default: 'pendiente',
    index: true,
  })
  status!: ScheduleStatus;

  createdAt!: Date;

  updatedAt!: Date;
}

export const ScheduleSchema = SchemaFactory.createForClass(Schedule);
ScheduleSchema.index({ tenantId: 1, eventId: 1, startAt: 1 });
