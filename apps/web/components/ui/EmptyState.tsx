export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-[1.375rem] border border-dashed border-teal/60 bg-white p-8 text-center shadow-[0_14px_30px_rgba(20,33,61,0.07)]">
      <h2 className="font-semibold">{title}</h2>
      {description ? (
        <p className="mt-2 text-sm text-muted">{description}</p>
      ) : null}
    </div>
  );
}
