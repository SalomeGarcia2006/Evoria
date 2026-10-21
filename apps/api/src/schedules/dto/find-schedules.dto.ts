import { IsEnum, IsOptional } from 'class-validator';
import { SCHEDULE_STATUSES, type ScheduleStatus } from '../schedules.constants';

export class FindSchedulesDto {
  @IsOptional()
  @IsEnum(SCHEDULE_STATUSES)
  status?: ScheduleStatus;
}
