import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  IsIn,
} from 'class-validator';
import { EVENT_STATUSES, type EventStatus } from '../events/events.constants';
import {
  INVENTORY_STATUSES,
  type InventoryStatus,
} from '../inventory/inventory.constants';

export class ReportQuery {
  @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @IsOptional() @IsISO8601({ strict: true }) to?: string;
  @IsOptional() @IsEnum(EVENT_STATUSES) status?: EventStatus;
  @IsOptional() @IsString() @MaxLength(80) eventType?: string;
  @IsOptional() @IsMongoId() responsibleUserId?: string;
  @IsOptional() @IsMongoId() eventId?: string;
  @IsOptional() @IsEnum(INVENTORY_STATUSES) inventoryStatus?: InventoryStatus;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  includeCancelled = false;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

export class ExportReportQuery extends ReportQuery {
  @IsOptional() @IsIn(['csv', 'pdf']) format: 'csv' | 'pdf' = 'csv';
  @IsOptional() @IsMongoId() teamId?: string;
}
