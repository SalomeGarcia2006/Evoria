'use client';

import { useState } from 'react';
import type { DashboardSummary } from '../types/dashboard';

export function useDashboard() {
  const [summary] = useState<DashboardSummary | null>(null);
  return { summary, isLoading: false, error: null };
}
