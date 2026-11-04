import type { HTMLAttributes } from 'react';

export function Card({
  className = '',
  density = 'default',
  ...props
}: HTMLAttributes<HTMLElement> & { density?: 'default' | 'compact' }) {
  return (
    <section
      className={`rounded-2xl border border-sky-blue bg-white ${density === 'compact' ? 'p-4' : 'p-6'} shadow-sm ${className}`}
      {...props}
    />
  );
}
