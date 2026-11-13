export function TenantFormStep({
  number,
  title,
}: {
  number: number;
  title: string;
}) {
  return (
    <h3 className="mt-2 flex items-center gap-3 text-base font-bold sm:col-span-2">
      <span
        className="grid size-8 shrink-0 place-items-center rounded-full bg-violet text-sm font-bold text-white"
        aria-hidden="true"
      >
        {number}
      </span>
      <span>
        <span className="sr-only">Paso {number}: </span>
        {title}
      </span>
    </h3>
  );
}
