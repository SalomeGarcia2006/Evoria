import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import {
  BUDGET_REQUEST_STATUSES,
  BUDGET_REQUEST_TYPES,
  type BudgetRequestStatus,
  type BudgetRequestType,
} from '../budgets.constants';

@Schema({ _id: true, versionKey: false })
export class EventBudgetRequest {
  _id!: Types.ObjectId;

  @Prop({ required: true, enum: BUDGET_REQUEST_TYPES })
  type!: BudgetRequestType;

  @Prop({ required: true, min: 1 })
  amountCop!: number;

  @Prop({ required: true, trim: true, minlength: 10, maxlength: 1000 })
  reason!: string;

  @Prop({ required: true, enum: BUDGET_REQUEST_STATUSES, default: 'pendiente' })
  status!: BudgetRequestStatus;

  @Prop({ type: 'ObjectId', ref: 'User', required: true })
  requestedBy!: Types.ObjectId;

  @Prop({ required: true, default: Date.now })
  requestedAt!: Date;

  @Prop({ type: 'ObjectId', ref: 'User', default: null })
  decidedBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  decidedAt!: Date | null;

  @Prop({ type: String, trim: true, maxlength: 1000, default: null })
  rejectionReason!: string | null;
}

export const EventBudgetRequestSchema =
  SchemaFactory.createForClass(EventBudgetRequest);

export type EventBudgetDocument = HydratedDocument<EventBudget>;

@Schema({ collection: 'event_budgets', timestamps: true, versionKey: false })
export class EventBudget {
  @Prop({ type: 'ObjectId', ref: 'Tenant', required: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: 'ObjectId', ref: 'Event', required: true })
  eventId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  baseAmountCop!: number;

  @Prop({ required: true, min: 0, default: 0 })
  approvedIncreaseCop!: number;

  @Prop({ required: true, min: 0, default: 0 })
  inventorySpentCop!: number;

  @Prop({ required: true, min: 0, default: 0 })
  providerSpentCop!: number;

  @Prop({ required: true, min: 0, default: 0 })
  extraSpentCop!: number;

  @Prop({ type: [EventBudgetRequestSchema], default: [] })
  requests!: EventBudgetRequest[];

  @Prop({ type: 'ObjectId', ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export const EventBudgetSchema = SchemaFactory.createForClass(EventBudget);
EventBudgetSchema.index({ tenantId: 1, eventId: 1 }, { unique: true });
