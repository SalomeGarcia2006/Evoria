'use client';

import { useState } from 'react';
import type { InventarioItem } from '../types/inventario';

export function useInventario() {
  const [inventario] = useState<InventarioItem[]>([]);
  return { inventario, isLoading: false, error: null };
}
