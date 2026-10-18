import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import {
  PERMISSION_STATUSES,
  type PermissionStatus,
} from '../permissions.constants';

export type PermissionDocument = HydratedDocument<Permission>;

@Schema({ collection: 'permissions', timestamps: true, versionKey: false })
export class Permission {
  @Prop({
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^[a-z0-9]+(\.[a-z0-9]+)+$/,
  })
  key!: string;

  @Prop({ required: true, trim: true, lowercase: true, index: true })
  moduleKey!: string;

  @Prop({ required: true, trim: true, minlength: 2, maxlength: 100 })
  moduleName!: string;

  @Prop({ required: true, trim: true, maxlength: 255 })
  moduleDescription!: string;

  @Prop({ required: true, enum: ['platform', 'tenant'], index: true })
  scope!: 'platform' | 'tenant';

  @Prop({ required: true, trim: true, lowercase: true })
  action!: string;

  @Prop({ required: true, trim: true, minlength: 2, maxlength: 100 })
  name!: string;

  @Prop({
    required: true,
    enum: PERMISSION_STATUSES,
    default: 'activo',
    index: true,
  })
  status!: PermissionStatus;
}

export const PermissionSchema = SchemaFactory.createForClass(Permission);
