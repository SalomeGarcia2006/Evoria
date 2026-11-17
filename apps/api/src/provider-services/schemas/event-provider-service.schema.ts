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

  @Prop({ required: true, min: 1, validate: Number.isSafeInteger })
  agreedAmountCop!: number;

  @Prop({
    required: true,
    enum: PROVIDER_SERVICE_STATUSES,
    default: 'pendiente',
  })
  status!: ProviderServiceStatus;

  @Prop({ type: 'ObjectId', ref: 'User', required: true })
  assignedBy!: Types.ObjectId;

  @Prop({ type: Date, default: null })
  cancelledAt!: Date | null;

  @Prop({ type: String, default: null }) providerEmail!: string | null;
  @Prop({ type: Number, default: 0 }) confirmationVersion!: number;
  @Prop({ type: Number, default: 0 }) notificationRevision!: number;
  @Prop({ type: String, default: null, select: false }) confirmationDigest!:
    string | null;
  @Prop({ type: Date, default: null }) responseExpiresAt!: Date | null;
  @Prop({ type: Date, default: null }) acceptedAt!: Date | null;
  @Prop({ type: Date, default: null }) fundingExpiresAt!: Date | null;
  @Prop({ type: Date, default: null }) confirmedAt!: Date | null;
  @Prop({ type: Date, default: null }) respondedAt!: Date | null;
  @Prop({ type: String, default: null }) responseDecision!:
    'aceptar' | 'rechazar' | null;
  @Prop({ type: String, maxlength: 1000, default: null }) rejectionReason!:
    string | null;
  @Prop({ type: String, default: null }) cancellationReason!: string | null;
  @Prop({ type: String, default: 'queued' }) emailDelivery!:
    'queued' | 'sent' | 'failed';
  @Prop({ type: Date, default: null }) emailSentAt!: Date | null;
  @Prop({ type: Date, default: null }) nextCheckAt!: Date | null;
  @Prop({ type: String, default: null }) idempotencyKey!: string | null;
  @Prop({ type: String, default: null, select: false }) requestFingerprint!:
    string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const EventProviderServiceSchema =
  SchemaFactory.createForClass(EventProviderService);
EventProviderServiceSchema.index({ tenantId: 1, eventId: 1, status: 1 });
EventProviderServiceSchema.index({ tenantId: 1, providerId: 1 });
EventProviderServiceSchema.index({ status: 1, nextCheckAt: 1, _id: 1 });
EventProviderServiceSchema.index(
  { tenantId: 1, assignedBy: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  },
);
