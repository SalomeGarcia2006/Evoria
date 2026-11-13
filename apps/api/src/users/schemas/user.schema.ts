import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';

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

  @Prop({ type: String, select: false, default: null })
  refreshTokenHash!: string | null;

  @Prop({ type: String, select: false, default: null })
  passwordResetCodeHash!: string | null;

  @Prop({ type: Date, select: false, default: null })
  passwordResetCodeExpiresAt!: Date | null;

  @Prop({ type: Date, select: false, default: null })
  passwordResetCodeSentAt!: Date | null;

  @Prop({ type: Number, select: false, default: 0 })
  passwordResetCodeAttempts!: number;

  @Prop({ required: true, enum: USER_STATUSES, default: 'activo', index: true })
  status!: UserStatus;

  @Prop({ required: true, default: 0, min: 0 })
  loginAttempts!: number;

  @Prop({ type: Date, default: null })
  lockedUntil!: Date | null;

  @Prop({ type: 'ObjectId', ref: 'Profile', default: null, index: true })
  platformProfileId!: Types.ObjectId | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
