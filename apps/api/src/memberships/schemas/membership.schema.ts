import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import { Profile } from '../../profiles/schemas/profile.schema';
import { Tenant } from '../../tenants/schemas/tenant.schema';
import { User } from '../../users/schemas/user.schema';
import {
  MEMBERSHIP_STATUSES,
  type MembershipStatus,
} from '../memberships.constants';

export type MembershipDocument = HydratedDocument<Membership>;

@Schema({ collection: 'memberships', timestamps: true, versionKey: false })
export class Membership {
  @Prop({ type: 'ObjectId', ref: User.name, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: 'ObjectId', ref: Tenant.name, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: 'ObjectId', ref: Profile.name, required: true, index: true })
  profileId!: Types.ObjectId;

  @Prop({
    required: true,
    enum: MEMBERSHIP_STATUSES,
    default: 'activo',
    index: true,
  })
  status!: MembershipStatus;
}

export const MembershipSchema = SchemaFactory.createForClass(Membership);
MembershipSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
