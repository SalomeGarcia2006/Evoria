export function UserPill() {
  return (
    <div className="flex items-center gap-3 rounded-full border border-sky-blue bg-white px-3 py-2 text-sm">
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-full bg-teal text-white"
      >
        E
      </span>
      <span className="hidden font-semibold sm:inline">Usuario</span>
    </div>
  );
}
