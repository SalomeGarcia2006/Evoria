export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-teal p-8 text-center">
      <h2 className="font-semibold">{title}</h2>
      {description ? (
        <p className="mt-2 text-sm text-teal">{description}</p>
      ) : null}
    </div>
  );
}
