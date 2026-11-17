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

export class RegistrationDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) token!: string;
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(2) @MaxLength(120) lastName!: string;
  @IsEmail() @MaxLength(150) email!: string;
  @IsString()
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_REQUIREMENTS })
  password!: string;
}

export class ConfirmRegistrationDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) token!: string;
  @IsEmail() @MaxLength(150) email!: string;
  @IsString() @Matches(/^[A-Z0-9]{6}$/) code!: string;
}
