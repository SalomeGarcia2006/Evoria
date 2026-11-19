import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { isEmail } from 'class-validator';
import {
  EVENT_CLIENT_LIMITS,
  EVENT_CLIENT_PHONE_PATTERN,
} from '../event-client.constants';

@Schema({ _id: false, id: false })
export class EventClient {
  @Prop({
    required: true,
    trim: true,
    minlength: EVENT_CLIENT_LIMITS.name.min,
    maxlength: EVENT_CLIENT_LIMITS.name.max,
  })
  name!: string;

  @Prop({
    required: true,
    trim: true,
    minlength: EVENT_CLIENT_LIMITS.identification.min,
    maxlength: EVENT_CLIENT_LIMITS.identification.max,
  })
  identification!: string;

  @Prop({
    required: true,
    trim: true,
    minlength: EVENT_CLIENT_LIMITS.phone.min,
    maxlength: EVENT_CLIENT_LIMITS.phone.max,
    match: EVENT_CLIENT_PHONE_PATTERN,
  })
  phone!: string;

  @Prop({
    required: true,
    trim: true,
    minlength: EVENT_CLIENT_LIMITS.address.min,
    maxlength: EVENT_CLIENT_LIMITS.address.max,
  })
  address!: string;

  @Prop({
    required: true,
    trim: true,
    lowercase: true,
    maxlength: EVENT_CLIENT_LIMITS.email.max,
    validate: (value: string) => isEmail(value),
  })
  email!: string;
}

export const EventClientSchema = SchemaFactory.createForClass(EventClient);
