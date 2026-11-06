import { UserPill } from './UserPill';
import { ThemeToggle } from './ThemeToggle';

export function Topbar({ title }: { title: string }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-sky-blue/80 bg-beige/90 px-6 py-4 backdrop-blur-sm">
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserPill />
      </div>
    </header>
  );
}
