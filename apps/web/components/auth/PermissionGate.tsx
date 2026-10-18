'use client';

import type { ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';

export function PermissionGate({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { can } = useAuth();

  return can(permission) ? children : null;
}
