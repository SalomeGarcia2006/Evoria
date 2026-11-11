import type { ReactNode } from 'react';

export function PageHero({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="events-hero">
      <div className="min-w-0">
        <h1 className="text-4xl font-bold">{title}</h1>
        <p className="mt-2 max-w-xl text-base text-muted">{description}</p>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      )}
    </header>
  );
}
