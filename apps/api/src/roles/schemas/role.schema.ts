import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { ROLE_NAMES, type RoleName } from '../roles.constants';

export type RoleDocument = HydratedDocument<Role>;

@Schema({ collection: 'roles', timestamps: true, versionKey: false })
export class Role {
  @Prop({ required: true, unique: true, trim: true, enum: ROLE_NAMES })
  name!: RoleName;

  @Prop({ required: true, trim: true, maxlength: 255 })
  description!: string;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
