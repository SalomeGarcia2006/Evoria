import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  EVENT_CLIENT_LIMITS,
  EVENT_CLIENT_PHONE_PATTERN,
} from '../event-client.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class EventClientDto {
  @Transform(trim)
  @IsString()
  @MinLength(EVENT_CLIENT_LIMITS.name.min)
  @MaxLength(EVENT_CLIENT_LIMITS.name.max)
  name!: string;

  @Transform(trim)
  @IsString()
  @MinLength(EVENT_CLIENT_LIMITS.identification.min)
  @MaxLength(EVENT_CLIENT_LIMITS.identification.max)
  identification!: string;

  @Transform(trim)
  @IsString()
  @MinLength(EVENT_CLIENT_LIMITS.phone.min)
  @MaxLength(EVENT_CLIENT_LIMITS.phone.max)
  @Matches(EVENT_CLIENT_PHONE_PATTERN)
  phone!: string;

  @Transform(trim)
  @IsString()
  @MinLength(EVENT_CLIENT_LIMITS.address.min)
  @MaxLength(EVENT_CLIENT_LIMITS.address.max)
  address!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @IsEmail()
  @MaxLength(EVENT_CLIENT_LIMITS.email.max)
  email!: string;
}
