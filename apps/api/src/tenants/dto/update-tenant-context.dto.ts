import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
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
