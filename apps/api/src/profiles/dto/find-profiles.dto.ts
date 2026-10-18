import { IsEnum, IsOptional } from 'class-validator';
import { PROFILE_STATUSES, type ProfileStatus } from '../profiles.constants';

export class FindProfilesDto {
  @IsOptional()
  @IsEnum(PROFILE_STATUSES)
  status?: ProfileStatus;
}
