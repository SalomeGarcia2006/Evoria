import type { HTMLAttributes } from 'react';

export function Card({
  className = '',
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={`rounded-2xl border border-sky-blue bg-white p-6 shadow-sm ${className}`}
      {...props}
    />
  );
}
