import {
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  IsUUID,
  Max,
} from 'class-validator';

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateProviderServiceDto {
  @IsOptional() @IsUUID() idempotencyKey?: string;
  @IsMongoId()
  providerId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  serviceName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @Matches(DATE_PATTERN)
  startDate!: string;

  @IsOptional()
  @Matches(TIME_PATTERN)
  startTime?: string | null;

  @IsOptional()
  @Matches(DATE_PATTERN)
  endDate?: string | null;

  @IsOptional()
  @Matches(TIME_PATTERN)
  endTime?: string | null;

  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  agreedAmountCop!: number;
}
