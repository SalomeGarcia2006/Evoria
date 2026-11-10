import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';

export type GoogleOAuthStateDocument = HydratedDocument<GoogleOAuthState>;

@Schema({ collection: 'google_oauth_states', versionKey: false })
export class GoogleOAuthState {
  @Prop({ required: true, unique: true })
  stateHash!: string;

  @Prop({ required: true, enum: ['login', 'link'] })
  mode!: 'login' | 'link';

  @Prop({ required: true })
  nonce!: string;

  @Prop({ required: true })
  codeVerifier!: string;

  @Prop({ type: 'ObjectId', ref: 'User', default: null })
  userId!: Types.ObjectId | null;

  @Prop({ type: String, enum: ['platform', 'tenant'], default: null })
  scope!: 'platform' | 'tenant' | null;

  @Prop({ type: String, default: null })
  membershipId!: string | null;

  @Prop({ type: String, default: null })
  accessTokenHash!: string | null;

  @Prop({ required: true })
  expiresAt!: Date;
}

export const GoogleOAuthStateSchema =
  SchemaFactory.createForClass(GoogleOAuthState);
GoogleOAuthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
