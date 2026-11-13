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

export class ConfirmPasswordResetDto {
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @IsString()
  @Matches(/^[A-Z0-9]{6}$/)
  code!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_REQUIREMENTS })
  newPassword!: string;
}
