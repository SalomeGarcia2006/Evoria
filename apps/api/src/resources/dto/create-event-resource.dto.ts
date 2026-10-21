import { Type } from 'class-transformer';
import { IsInt, IsMongoId, Min } from 'class-validator';

export class CreateEventResourceDto {
  @IsMongoId()
  inventoryItemId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}
