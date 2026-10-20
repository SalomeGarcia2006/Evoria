import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
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
  @MinLength(8)
  ownerPassword!: string;
}
