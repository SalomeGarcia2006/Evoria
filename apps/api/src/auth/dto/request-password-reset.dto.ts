import { IsEmail, MaxLength } from 'class-validator';

export class RequestPasswordResetDto {
  @IsEmail()
  @MaxLength(150)
  email!: string;
}
