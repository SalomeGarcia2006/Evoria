import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsMongoId,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
export class CreateTeamDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  specialty!: string;
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsMongoId({ each: true })
  memberIds!: string[];
  @IsMongoId()
  leaderId!: string;
}
