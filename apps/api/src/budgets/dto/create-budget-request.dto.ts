import {
  IsEnum,
  IsInt,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  BUDGET_REQUEST_TYPES,
  type BudgetRequestType,
} from '../budgets.constants';

export class CreateBudgetRequestDto {
  @IsEnum(BUDGET_REQUEST_TYPES)
  type!: BudgetRequestType;

  @IsInt()
  @Min(1)
  amountCop!: number;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;
}
