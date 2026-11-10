import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { LoginRequest } from '@evoria/contracts';
import { CaptchaDto } from './captcha.dto';

export class LoginDto extends CaptchaDto implements LoginRequest {
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
