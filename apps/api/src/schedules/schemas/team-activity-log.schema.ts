import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, type Types } from 'mongoose';

@Schema({
  collection: 'team_activity_logs',
  timestamps: true,
  versionKey: false,
})
export class TeamActivityLog {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  scheduleId!: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  eventId!: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  teamId!: Types.ObjectId;
  @Prop({
    type: String,
    required: true,
    enum: ['asignado', 'retirado', 'completado'],
  })
  action!: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, default: null })
  actorId!: Types.ObjectId | null;
  @Prop({ type: String, required: true })
  actorName!: string;
  createdAt!: Date;
}
export const TeamActivityLogSchema =
  SchemaFactory.createForClass(TeamActivityLog);
TeamActivityLogSchema.index({
  tenantId: 1,
  scheduleId: 1,
  createdAt: 1,
  _id: 1,
});
