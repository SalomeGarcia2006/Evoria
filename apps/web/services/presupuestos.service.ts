import type { BudgetOverview } from '@evoria/contracts';
import { apiRequest } from './api';

export async function getBudgets(page = 1): Promise<BudgetOverview> {
  const response = await apiRequest<{ data: BudgetOverview }>(
    `/budgets?limit=100&page=${page}`,
    { credentials: 'include', cache: 'no-store' },
  );
  return response.data;
}

export async function getAllBudgets(): Promise<BudgetOverview> {
  const result = await getBudgets();
  for (let page = 2; page <= result.pagination.totalPages; page += 1) {
    const next = await getBudgets(page);
    result.items.push(...next.items);
  }
  return result;
}
