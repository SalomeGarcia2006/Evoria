export function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex rounded-full bg-sky-blue px-3 py-1 text-xs font-semibold text-navy">
      {status}
    </span>
  );
}
