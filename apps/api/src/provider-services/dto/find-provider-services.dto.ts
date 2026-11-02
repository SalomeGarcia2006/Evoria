import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class FindProviderServicesDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  includeCancelled = false;
}
