import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import {
  RESOURCE_ASSIGNMENT_STATUSES,
  type ResourceAssignmentStatus,
} from '../resources.constants';

export type EventResourceDocument = HydratedDocument<EventResource>;

@Schema({ collection: 'event_resources', timestamps: true, versionKey: false })
export class EventResource {
  @Prop({ type: 'ObjectId', ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: 'ObjectId', ref: 'Event', required: true, index: true })
  eventId!: Types.ObjectId;

  @Prop({ type: 'ObjectId', ref: 'InventoryItem', required: true, index: true })
  inventoryItemId!: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  @Prop({
    required: true,
    enum: RESOURCE_ASSIGNMENT_STATUSES,
    default: 'asignado',
    index: true,
  })
  status!: ResourceAssignmentStatus;

  @Prop({ type: 'ObjectId', ref: 'User', required: true, index: true })
  assignedBy!: Types.ObjectId;

  @Prop({ required: true, default: Date.now })
  assignedAt!: Date;

  @Prop({ type: Date, default: null })
  returnedAt!: Date | null;

  createdAt!: Date;

  updatedAt!: Date;
}

export const EventResourceSchema = SchemaFactory.createForClass(EventResource);
EventResourceSchema.index(
  { tenantId: 1, eventId: 1, inventoryItemId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'asignado' } },
);
