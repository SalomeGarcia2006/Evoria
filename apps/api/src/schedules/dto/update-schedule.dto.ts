import {
  IsEnum,
  IsISO8601,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SCHEDULE_STATUSES, type ScheduleStatus } from '../schedules.constants';

export class UpdateScheduleDto {
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
  @IsMongoId()
  responsibleUserId?: string | null;

  @IsOptional()
  @IsEnum(SCHEDULE_STATUSES)
  status?: ScheduleStatus;
}
