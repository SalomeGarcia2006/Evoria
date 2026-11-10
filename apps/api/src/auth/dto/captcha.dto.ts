import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CaptchaDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  captchaToken?: string;
}
