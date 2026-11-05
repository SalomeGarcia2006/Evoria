export function LoadingState({ label = 'Cargando...' }: { label?: string }) {
  return (
    <div
      aria-live="polite"
      className="rounded-[1.125rem] border border-sky-blue bg-white p-6 text-sm text-muted shadow-[0_14px_30px_rgba(20,33,61,0.07)]"
    >
      {label}
    </div>
  );
}
