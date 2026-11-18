'use client';

import { useEffect, useState } from 'react';
import { apiErrorMessage } from '../services/api';
import { getReportsSummary } from '../services/reports.service';
import { useAuth } from './useAuth';

type Result = {
  ownerId: string;
  data: Awaited<ReturnType<typeof getReportsSummary>>;
  error?: string;
};

export function useReportsOverview() {
  const { user } = useAuth();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Result>();

  useEffect(() => {
    if (!user) {
      return;
    }
    let active = true;
    getReportsSummary()
      .then((data) => {
        if (active) setResult({ ownerId: user.id, data });
      })
      .catch((error: unknown) => {
        if (active)
          setResult({
            ownerId: user.id,
            data: { events: null, budgets: null, inventory: null },
            error: apiErrorMessage(error),
          });
      });
    return () => {
      active = false;
    };
  }, [revision, user]);

  const data =
    result && user && result.ownerId === user.id ? result.data : undefined;
  const error =
    result && user && result.ownerId === user.id ? result.error : undefined;
  return {
    data,
    error,
    loading: Boolean(user) && !data,
    refresh: () => setRevision((value) => value + 1),
  };
}
