'use client';

import { useEffect, useState } from 'react';
import { apiErrorMessage } from '../services/api';
import { getReport, getReportsSummary } from '../services/reports.service';
import { useAuth } from './useAuth';

type Result = {
  ownerId: string;
  data: {
    summary: Awaited<ReturnType<typeof getReportsSummary>>;
    schedules: {
      total: number;
      completed: number;
      eventsWithSchedule: number;
    } | null;
  };
  error?: string;
};

export function useReportsOverview() {
  const { user, can } = useAuth();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Result>();

  useEffect(() => {
    if (!user) {
      return;
    }
    let active = true;
    const schedules =
      can('cronogramas.ver') && can('eventos.ver')
        ? getReport('schedules', { page: 1, limit: 100 })
            .then((report) => {
              const items = report.items as Array<{
                total: number;
                completado: number;
              }>;
              return {
                total: items.reduce((total, item) => total + item.total, 0),
                completed: items.reduce(
                  (total, item) => total + item.completado,
                  0,
                ),
                eventsWithSchedule: items.length,
              };
            })
            .catch(() => null)
        : Promise.resolve(null);
    Promise.all([getReportsSummary(), schedules])
      .then(([summary, scheduleSummary]) => {
        if (active)
          setResult({
            ownerId: user.id,
            data: { summary, schedules: scheduleSummary },
          });
      })
      .catch((error: unknown) => {
        if (active)
          setResult({
            ownerId: user.id,
            data: {
              summary: { events: null, budgets: null, inventory: null },
              schedules: null,
            },
            error: apiErrorMessage(error),
          });
      });
    return () => {
      active = false;
    };
  }, [can, revision, user]);

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
