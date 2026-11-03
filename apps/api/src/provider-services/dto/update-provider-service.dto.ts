import {
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { DATE_PATTERN, TIME_PATTERN } from './create-provider-service.dto';

export class UpdateProviderServiceDto {
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsMongoId()
  providerId?: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  serviceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @Matches(DATE_PATTERN)
  startDate?: string;

  @IsOptional()
  @Matches(TIME_PATTERN)
  startTime?: string | null;

  @IsOptional()
  @Matches(DATE_PATTERN)
  endDate?: string | null;

  @IsOptional()
  @Matches(TIME_PATTERN)
  endTime?: string | null;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  agreedAmountCop?: number;
}
