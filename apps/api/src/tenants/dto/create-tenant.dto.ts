import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  PASSWORD_PATTERN,
  PASSWORD_REQUIREMENTS,
} from '../../users/password.policy';

export class CreateTenantDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  nit!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  ownerName!: string;

  @IsEmail()
  @MaxLength(150)
  ownerEmail!: string;

  @IsString()
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_REQUIREMENTS })
  ownerPassword!: string;
}
