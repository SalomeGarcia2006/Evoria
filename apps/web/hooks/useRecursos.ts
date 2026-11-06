'use client';

import { useEffect, useState } from 'react';
import {
  getResources,
  getAllResources,
  type ResourceFilters,
  type RecursosServiceResult,
} from '../services/recursos.service';
import { useAuth } from './useAuth';

export function useRecursos(
  {
    search = '',
    type = '',
    status = '',
    page = 1,
    limit = 20,
  }: ResourceFilters = {},
  allPages = false,
) {
  const { user, can } = useAuth();
  const allowed = can('inventario.ver');
  const [result, setResult] = useState<{
    data?: RecursosServiceResult;
    error?: string;
    key: string;
    context?: string;
  }>({ key: '' });
  const [attempt, setAttempt] = useState(0);
  const context = JSON.stringify([
    user?.id,
    user?.tenant?.id,
    allowed,
    search,
    type,
    status,
    page,
    limit,
    allPages,
  ]);
  const key = JSON.stringify([context, attempt]);
  useEffect(() => {
    if (!user || !allowed) return;
    let active = true;
    (allPages
      ? getAllResources()
      : getResources({ search, type, status, page, limit })
    )
      .then((data) => {
        if (active) setResult({ data, key, context });
      })
      .catch((error: unknown) => {
        if (active)
          setResult((previous) => ({
            key,
            context,
            data: previous.context === context ? previous.data : undefined,
            error:
              error instanceof Error
                ? error.message
                : 'No fue posible cargar los recursos.',
          }));
      });
    return () => {
      active = false;
    };
  }, [
    search,
    type,
    status,
    page,
    limit,
    key,
    context,
    allPages,
    user,
    allowed,
  ]);
  const data = result.context === context ? result.data : undefined;
  return {
    recursos: data?.items ?? [],
    pagination: data?.pagination,
    isLoading: !data && result.key !== key,
    error: result.key === key ? result.error : undefined,
    retry: () => setAttempt((value) => value + 1),
  };
}
