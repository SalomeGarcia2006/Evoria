import {
  IsEnum,
  IsISO8601,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EVENT_STATUSES, type EventStatus } from '../events.constants';

export class CreateEventDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsISO8601()
  startAt!: string;

  @IsISO8601()
  endAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  type?: string;

  @IsOptional()
  @IsEnum(EVENT_STATUSES)
  status?: EventStatus;

  @IsOptional()
  @IsMongoId()
  responsibleUserId?: string;
}
