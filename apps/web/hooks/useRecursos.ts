'use client';

import { useEffect, useState } from 'react';
import {
  getResources,
  type ResourceFilters,
  type RecursosServiceResult,
} from '../services/recursos.service';

export function useRecursos({
  search = '',
  type = '',
  status = '',
  page = 1,
  limit = 20,
}: ResourceFilters = {}) {
  const [result, setResult] = useState<{
    data?: RecursosServiceResult;
    error?: string;
    key: string;
  }>({ key: '' });
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([search, type, status, page, limit, attempt]);
  useEffect(() => {
    let active = true;
    getResources({ search, type, status, page, limit })
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
  }, [search, type, status, page, limit, key]);
  return {
    recursos: result.key === key ? (result.data?.items ?? []) : [],
    pagination: result.key === key ? result.data?.pagination : undefined,
    isLoading: result.key !== key,
    error: result.key === key ? result.error : undefined,
    retry: () => setAttempt((value) => value + 1),
  };
}
