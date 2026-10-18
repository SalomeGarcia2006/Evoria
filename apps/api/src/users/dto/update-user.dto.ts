import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import {
  MEMBERSHIP_STATUSES,
  type MembershipStatus,
} from '../../memberships/memberships.constants';

export class UpdateUserDto {
  @IsOptional()
  @IsMongoId()
  profileId?: string;

  @IsOptional()
  @IsEnum(MEMBERSHIP_STATUSES)
  status?: MembershipStatus;
}
