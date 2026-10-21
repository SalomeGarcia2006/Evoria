import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  INVENTORY_STATUSES,
  type InventoryStatus,
} from '../inventory.constants';

export class CreateInventoryItemDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalQuantity!: number;

  @IsOptional()
  @IsEnum(INVENTORY_STATUSES)
  status?: InventoryStatus;
}
