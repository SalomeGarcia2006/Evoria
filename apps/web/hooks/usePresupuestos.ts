'use client';

import { useState } from 'react';
import type { Presupuesto } from '../types/presupuesto';

export function usePresupuestos() {
  const [presupuestos] = useState<Presupuesto[]>([]);
  return { presupuestos, isLoading: false, error: null };
}
