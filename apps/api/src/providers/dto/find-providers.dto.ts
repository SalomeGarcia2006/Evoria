import {
  PROVIDER_CATEGORIES,
  PROVIDER_STATUSES,
  type ProviderCategory,
  type ProviderStatus,
} from '../providers.constants';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class FindProvidersDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsEnum(PROVIDER_CATEGORIES)
  category?: ProviderCategory;

  @IsOptional()
  @IsEnum(PROVIDER_STATUSES)
  status?: ProviderStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
