import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import {
  TENANT_OPERATION_MODES,
  type TenantOperationMode,
} from '../tenants.constants';

class OperationalAreaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(250, { each: true })
  responsibilities!: string[];

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(250, { each: true })
  authorizations!: string[];
}

export class UpdateTenantContextDto {
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(253)
  @Matches(
    /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i,
  )
  emailDomain?: string;
  @IsOptional() @IsString() @MaxLength(80) sector?: string;
  @IsOptional() @IsString() @MaxLength(1500) operationalDescription?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  eventTypes?: string[];
  @IsOptional()
  @IsEnum(TENANT_OPERATION_MODES)
  operationMode?: TenantOperationMode;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => OperationalAreaDto)
  operationalAreas?: OperationalAreaDto[];
  @IsOptional() @IsString() @MaxLength(2000) operationalNotes?: string;
}
