import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, type Types } from 'mongoose';

@Schema({ collection: 'team_specialties', timestamps: true, versionKey: false })
export class TeamSpecialty {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Tenant', required: true })
  tenantId!: Types.ObjectId;
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 100 })
  name!: string;
  @Prop({ required: true })
  normalizedName!: string;
}
export const TeamSpecialtySchema = SchemaFactory.createForClass(TeamSpecialty);
TeamSpecialtySchema.index({ tenantId: 1, normalizedName: 1 }, { unique: true });
