import { UserPill } from './UserPill';

export function Topbar({ title }: { title: string }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-sky-blue bg-beige px-6 py-4">
      <h1 className="text-xl font-bold">{title}</h1>
      <UserPill />
    </header>
  );
}
