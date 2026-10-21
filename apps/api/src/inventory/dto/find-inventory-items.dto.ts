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
import {
  INVENTORY_STATUSES,
  type InventoryStatus,
} from '../inventory.constants';

export class FindInventoryItemsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  type?: string;

  @IsOptional()
  @IsEnum(INVENTORY_STATUSES)
  status?: InventoryStatus;

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
