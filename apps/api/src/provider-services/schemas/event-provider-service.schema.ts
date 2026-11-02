import {
  PROVIDER_SERVICE_STATUSES,
  type ProviderServiceStatus,
} from '../provider-services.constants';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';

export type EventProviderServiceDocument =
  HydratedDocument<EventProviderService>;

@Schema({
  collection: 'event_provider_services',
  timestamps: true,
  versionKey: false,
})
export class EventProviderService {
  @Prop({ type: 'ObjectId', ref: 'Tenant', required: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: 'ObjectId', ref: 'Event', required: true })
  eventId!: Types.ObjectId;

  @Prop({ type: 'ObjectId', ref: 'Provider', required: true })
  providerId!: Types.ObjectId;

  @Prop({ required: true, trim: true, minlength: 2, maxlength: 120 })
  serviceName!: string;

  @Prop({ type: String, trim: true, maxlength: 2000, default: null })
  description!: string | null;

  @Prop({ required: true, match: /^\d{4}-\d{2}-\d{2}$/ })
  startDate!: string;

  @Prop({ type: String, default: null })
  startTime!: string | null;

  @Prop({ type: String, default: null })
  endDate!: string | null;

  @Prop({ type: String, default: null })
  endTime!: string | null;

  @Prop({ required: true, min: 1 })
  agreedAmountCop!: number;

  @Prop({
    required: true,
    enum: PROVIDER_SERVICE_STATUSES,
    default: 'confirmado',
  })
  status!: ProviderServiceStatus;

  @Prop({ type: 'ObjectId', ref: 'User', required: true })
  assignedBy!: Types.ObjectId;

  @Prop({ type: Date, default: null })
  cancelledAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const EventProviderServiceSchema =
  SchemaFactory.createForClass(EventProviderService);
EventProviderServiceSchema.index({ tenantId: 1, eventId: 1, status: 1 });
EventProviderServiceSchema.index({ tenantId: 1, providerId: 1 });
