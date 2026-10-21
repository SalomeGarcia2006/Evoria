'use client';

import { useState } from 'react';
import type { Recurso } from '../types/recurso';

export function useRecursos() {
  const [recursos] = useState<Recurso[]>([]);
  return { recursos, isLoading: false, error: null };
}
