'use client';

import { useState } from 'react';
import type { AuthUser } from '../types/auth';

export function useAuth() {
  const [user] = useState<AuthUser | null>(null);
  return { user, isAuthenticated: user !== null };
}
