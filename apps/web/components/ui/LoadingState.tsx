export function LoadingState({ label = 'Cargando...' }: { label?: string }) {
  return (
    <div
      aria-live="polite"
      className="rounded-xl bg-sky-blue/40 p-6 text-sm text-teal"
    >
      {label}
    </div>
  );
}
