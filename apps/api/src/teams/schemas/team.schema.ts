import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Schema as MongooseSchema,
  type HydratedDocument,
  type Types,
} from 'mongoose';

export type TeamDocument = HydratedDocument<Team>;

@Schema({ collection: 'teams', timestamps: true, versionKey: false })
export class Team {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  })
  tenantId!: Types.ObjectId;
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 120 })
  name!: string;
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 100 })
  specialty!: string;
  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }],
    required: true,
  })
  memberIds!: Types.ObjectId[];
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  leaderId!: Types.ObjectId;
  @Prop({
    type: String,
    enum: ['activo', 'inactivo'],
    default: 'activo',
    required: true,
  })
  status!: 'activo' | 'inactivo';
  @Prop({ type: Number, default: 0 })
  assignmentRevision!: number;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;
  createdAt!: Date;
  updatedAt!: Date;
}
export const TeamSchema = SchemaFactory.createForClass(Team);
TeamSchema.index(
  { tenantId: 1, memberIds: 1 },
  { unique: true, partialFilterExpression: { status: 'activo' } },
);
TeamSchema.index({ tenantId: 1, status: 1, name: 1 });
