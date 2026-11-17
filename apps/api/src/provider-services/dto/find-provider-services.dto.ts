import { IsBoolean, IsOptional, IsIn } from 'class-validator';
import {
  PROVIDER_SERVICE_STATUSES,
  type ProviderServiceStatus,
} from '../provider-services.constants';
import { Transform } from 'class-transformer';

export class FindProviderServicesDto {
  @IsOptional() @IsIn(PROVIDER_SERVICE_STATUSES) status?: ProviderServiceStatus;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  includeCancelled = false;
}
