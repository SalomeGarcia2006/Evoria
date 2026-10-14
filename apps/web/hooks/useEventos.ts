'use client';

import { useState } from 'react';
import type { Evento } from '../types/evento';

export function useEventos() {
  const [eventos] = useState<Evento[]>([]);
  return { eventos, isLoading: false, error: null };
}
