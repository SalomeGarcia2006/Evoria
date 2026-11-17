import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Types } from 'mongoose';

@Schema({
  collection: 'provider_service_mail_jobs',
  timestamps: true,
  versionKey: false,
})
export class ProviderServiceMail {
  @Prop({ type: 'ObjectId', required: true }) tenantId!: Types.ObjectId;
  @Prop({ type: 'ObjectId', required: true }) serviceId!: Types.ObjectId;
  @Prop({ required: true }) version!: number;
  @Prop({ required: true, enum: ['request', 'cancel'] }) kind!:
    'request' | 'cancel';
  @Prop({ required: true }) recipient!: string;
  @Prop({ required: true }) nextAttemptAt!: Date;
  @Prop({ default: 0 }) attempts!: number;
  @Prop({ type: Date, default: null }) deliveredAt!: Date | null;
  @Prop({ type: Date, default: null }) claimedUntil!: Date | null;
  @Prop({ type: String, default: null }) claimId!: string | null;
  createdAt!: Date;
}
export const ProviderServiceMailSchema =
  SchemaFactory.createForClass(ProviderServiceMail);
ProviderServiceMailSchema.index(
  { tenantId: 1, serviceId: 1, version: 1, kind: 1 },
  { unique: true },
);
ProviderServiceMailSchema.index({
  deliveredAt: 1,
  nextAttemptAt: 1,
  claimedUntil: 1,
});
ProviderServiceMailSchema.index(
  { deliveredAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);
