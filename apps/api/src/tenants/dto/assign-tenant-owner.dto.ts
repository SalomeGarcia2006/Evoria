import { IsMongoId } from 'class-validator';

export class AssignTenantOwnerDto {
  @IsMongoId()
  userId!: string;
}
