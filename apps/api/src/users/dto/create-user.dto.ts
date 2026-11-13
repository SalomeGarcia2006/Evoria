import {
  IsEmail,
  IsMongoId,
  Matches,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PASSWORD_PATTERN, PASSWORD_REQUIREMENTS } from '../password.policy';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(150)
  email!: string;

  @IsString()
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_REQUIREMENTS })
  password!: string;

  @IsMongoId()
  profileId!: string;
}
