import {
  IsEmail,
  IsMongoId,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(150)
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsMongoId()
  profileId!: string;
}
