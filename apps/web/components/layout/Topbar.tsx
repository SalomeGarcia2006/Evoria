import { UserPill } from './UserPill';

export function Topbar({
  title,
  hideTitle = false,
}: {
  title: string;
  hideTitle?: boolean;
}) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-sky-blue/80 bg-beige/90 px-6 py-4 backdrop-blur-sm">
      {hideTitle ? (
        <span aria-hidden="true" />
      ) : (
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      )}
      <UserPill />
    </header>
  );
}
