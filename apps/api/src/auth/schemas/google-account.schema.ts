import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';

export type GoogleAccountDocument = HydratedDocument<GoogleAccount>;

@Schema({ collection: 'google_accounts', timestamps: true, versionKey: false })
export class GoogleAccount {
  @Prop({ type: 'ObjectId', ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  subject!: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ type: Date, default: null })
  lastUsedAt!: Date | null;

  createdAt!: Date;
}

export const GoogleAccountSchema = SchemaFactory.createForClass(GoogleAccount);
GoogleAccountSchema.index({ subject: 1 }, { unique: true });
GoogleAccountSchema.index({ userId: 1 }, { unique: true });
