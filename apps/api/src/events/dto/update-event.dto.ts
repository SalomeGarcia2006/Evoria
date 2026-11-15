import {
  IsEnum,
  IsISO8601,
  IsMongoId,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EVENT_STATUSES, type EventStatus } from '../events.constants';

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @IsOptional()
  @IsISO8601()
  endAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  type?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  baseBudget?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  invitados?: number;

  @IsOptional()
  @IsEnum(EVENT_STATUSES)
  status?: EventStatus;

  @IsOptional()
  @IsMongoId()
  responsibleUserId?: string | null;
}
