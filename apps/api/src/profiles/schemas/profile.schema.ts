import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import { Permission } from '../../permissions/schemas/permission.schema';
import { PROFILE_STATUSES, type ProfileStatus } from '../profiles.constants';

export type ProfileDocument = HydratedDocument<Profile>;

@Schema({ collection: 'profiles', timestamps: true, versionKey: false })
export class Profile {
  @Prop({
    required: true,
    unique: true,
    trim: true,
    minlength: 2,
    maxlength: 80,
  })
  name!: string;

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
