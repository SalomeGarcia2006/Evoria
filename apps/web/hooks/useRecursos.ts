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
  }>({ key: '' });
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([
    user?.id,
    user?.tenant?.id,
    allowed,
    search,
    type,
    status,
    page,
    limit,
    attempt,
    allPages,
  ]);
  useEffect(() => {
    if (!user || !allowed) return;
    let active = true;
    (allPages
      ? getAllResources()
      : getResources({ search, type, status, page, limit })
    )
      .then((data) => {
        if (active) setResult({ data, key });
      })
      .catch((error: unknown) => {
        if (active)
          setResult({
            key,
            error:
              error instanceof Error
                ? error.message
                : 'No fue posible cargar los recursos.',
          });
      });
    return () => {
      active = false;
    };
  }, [search, type, status, page, limit, key, allPages, user, allowed]);
  return {
    recursos: result.key === key ? (result.data?.items ?? []) : [],
    pagination: result.key === key ? result.data?.pagination : undefined,
    isLoading: result.key !== key,
    error: result.key === key ? result.error : undefined,
    retry: () => setAttempt((value) => value + 1),
  };
}
