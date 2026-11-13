import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';

export class VerifyPasswordResetDto {
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @IsString()
  @Matches(/^[A-Z0-9]{6}$/)
  code!: string;
}
