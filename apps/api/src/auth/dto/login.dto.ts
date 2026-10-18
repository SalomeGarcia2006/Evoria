import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { LoginRequest } from '@evoria/contracts';

export class LoginDto implements LoginRequest {
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
