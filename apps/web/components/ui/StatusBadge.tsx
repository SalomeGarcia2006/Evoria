export function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex rounded-full bg-violet/10 px-3 py-1 text-xs font-semibold text-violet">
      {status}
    </span>
  );
}
