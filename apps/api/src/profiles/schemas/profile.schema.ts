import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import { Permission } from '../../permissions/schemas/permission.schema';
import { Tenant } from '../../tenants/schemas/tenant.schema';
import { PROFILE_STATUSES, type ProfileStatus } from '../profiles.constants';

export type ProfileDocument = HydratedDocument<Profile>;

@Schema({ collection: 'profiles', timestamps: true, versionKey: false })
export class Profile {
  @Prop({
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 80,
  })
  name!: string;

  @Prop({ type: 'ObjectId', ref: Tenant.name, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 255 })
  description!: string;

  @Prop({ type: [{ type: 'ObjectId', ref: Permission.name }], default: [] })
  permissionIds!: Types.ObjectId[];

  @Prop({
    required: true,
    enum: PROFILE_STATUSES,
    default: 'activo',
    index: true,
  })
  status!: ProfileStatus;

  @Prop({ required: true, default: false })
  isSystem!: boolean;
}

export const ProfileSchema = SchemaFactory.createForClass(Profile);
ProfileSchema.index({ tenantId: 1, name: 1 }, { unique: true });
