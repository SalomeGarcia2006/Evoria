import { Type } from 'class-transformer';
import { IsIn, IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';

export class FindAlertsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsIn(['true', 'false']) unread?: string;
  @IsOptional() @IsIn(['info', 'warning']) severity?: string;
  @IsOptional()
  @IsIn([
    'event_responsibility',
    'budget_pending',
    'budget_decided',
    'budget_limit',
    'inventory_low',
    'event_cancelled',
  ])
  type?: string;
  @IsOptional() @IsMongoId() eventId?: string;
}
