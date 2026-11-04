import { IsInt, Min } from 'class-validator';

export class InitializeEventBudgetDto {
  @IsInt()
  @Min(0)
  baseAmountCop!: number;
}
