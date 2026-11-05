import type { HTMLAttributes } from 'react';

export function Card({
  className = '',
  density = 'default',
  ...props
}: HTMLAttributes<HTMLElement> & { density?: 'default' | 'compact' }) {
  return (
    <section
      className={`rounded-[1.5rem] border border-sky-blue bg-white ${density === 'compact' ? 'p-4' : 'p-6'} shadow-[0_14px_30px_rgba(20,33,61,0.1)] ${className}`}
      {...props}
    />
  );
}
