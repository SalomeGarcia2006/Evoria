'use client';
import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { getDashboard } from '../services/dashboard.service';
import {
  getBudgetAuthorizations,
  type BudgetAuthorization,
} from '../services/presupuestos.service';
import { apiErrorMessage } from '../services/api';

type Overview = {
  summary: Awaited<ReturnType<typeof getDashboard>>;
  authorizations: BudgetAuthorization[] | null;
  errors: string[];
};

export function useOperationalOverview(includeAuthorizations = false) {
  const { user, can } = useAuth();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    owner: typeof user;
    revision: number;
    data: Overview;
  }>();
  useEffect(() => {
    if (!user) return;
    let active = true;
    const authorizations: Promise<
      | { items: BudgetAuthorization[]; error?: never }
      | { items?: never; error: string }
      | null
    > =
      includeAuthorizations && can('presupuestos.aprobar')
        ? getBudgetAuthorizations()
            .then((items) => ({ items }))
            .catch((error: unknown) => ({ error: apiErrorMessage(error) }))
        : Promise.resolve(null);
    Promise.all([getDashboard(can), authorizations]).then(
      ([summary, inbox]) => {
        if (active)
          setResult({
            owner: user,
            revision,
            data: {
              summary,
              authorizations: inbox?.items ?? null,
              errors: [
                ...summary.errors,
                ...(inbox?.error ? [`Autorizaciones: ${inbox.error}`] : []),
              ],
            },
          });
      },
    );
    return () => {
      active = false;
    };
  }, [user, can, revision, includeAuthorizations]);
  const data = result?.owner === user ? result.data : undefined;
  return {
    data,
    loading: !data,
    refresh: () => setRevision((value) => value + 1),
  };
}
