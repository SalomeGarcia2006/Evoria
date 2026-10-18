import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  MEMBERSHIP_STATUSES,
  type MembershipStatus,
} from '../../memberships/memberships.constants';

export class FindUsersDto {
  @IsOptional()
  @IsEnum(MEMBERSHIP_STATUSES)
  status?: MembershipStatus;

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
