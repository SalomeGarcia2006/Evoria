import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import { Role } from '../../roles/schemas/role.schema';

export const USER_STATUSES = ['activo', 'inactivo', 'bloqueado'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export type UserDocument = HydratedDocument<User>;

@Schema({ collection: 'users', timestamps: true, versionKey: false })
export class User {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 120 })
  name!: string;

  @Prop({
    required: true,
    unique: true,
    index: true,
    trim: true,
    lowercase: true,
    maxlength: 150,
  })
  email!: string;

  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({ type: 'ObjectId', ref: Role.name, required: true, index: true })
  roleId!: Types.ObjectId;

  @Prop({ required: true, enum: USER_STATUSES, default: 'activo', index: true })
  status!: UserStatus;

  @Prop({ required: true, default: 0, min: 0 })
  loginAttempts!: number;

  @Prop({ type: Date, default: null })
  lockedUntil!: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
