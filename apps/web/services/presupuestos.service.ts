import type {
  BudgetOverview,
  BudgetRequest,
  EventBudgetDetail,
  CreateBudgetRequest,
  ApiResponse,
} from '@evoria/contracts';
import { apiRequest } from './api';

export async function getBudgets(
  page = 1,
  search = '',
  limit = 10,
): Promise<BudgetOverview> {
  const response = await apiRequest<{ data: BudgetOverview }>(
    `/budgets?${new URLSearchParams({ limit: String(limit), page: String(page), search })}`,
    { credentials: 'include', cache: 'no-store' },
  );
  return response.data;
}

export async function getAllBudgets(): Promise<BudgetOverview> {
  const result = await getBudgets(1, '', 100);
  for (let page = 2; page <= result.pagination.totalPages; page += 1) {
    const next = await getBudgets(page, '', 100);
    result.items.push(...next.items);
  }
  return result;
}

async function budgetRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await apiRequest<ApiResponse<T>>(path, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'include',
    cache: 'no-store',
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
  return response.data;
}
export const getEventBudget = (eventId: string) =>
  budgetRequest<EventBudgetDetail>(
    `/events/${encodeURIComponent(eventId)}/budget`,
  );
export const initializeBudget = (eventId: string, baseAmountCop: number) =>
  budgetRequest(`/events/${encodeURIComponent(eventId)}/budget`, {
    baseAmountCop,
  });
export const submitBudgetRequest = (
  eventId: string,
  body: CreateBudgetRequest,
) =>
  budgetRequest<BudgetRequest>(
    `/events/${encodeURIComponent(eventId)}/budget/requests`,
    body,
  );
export type BudgetAuthorization = BudgetRequest & { eventName: string };
export const getBudgetAuthorizations = () =>
  budgetRequest<BudgetAuthorization[]>('/budgets/authorizations');
export const approveBudgetRequest = (eventId: string, requestId: string) =>
  budgetRequest<BudgetRequest>(
    `/events/${encodeURIComponent(eventId)}/budget/requests/${encodeURIComponent(requestId)}/approve`,
    {},
  );
export const rejectBudgetRequest = (
  eventId: string,
  requestId: string,
  reason: string,
) =>
  budgetRequest<BudgetRequest>(
    `/events/${encodeURIComponent(eventId)}/budget/requests/${encodeURIComponent(requestId)}/reject`,
    { reason },
  );
