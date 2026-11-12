import { Button } from './Button';

export function Pagination({
  page,
  totalPages,
  total,
  label,
  onPageChange,
  disabled = false,
}: {
  page: number;
  totalPages: number;
  total: number;
  label: string;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label={`Paginación de ${label}`}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-muted">
        Página {page} de {totalPages} · {total} {label}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente
        </Button>
      </div>
    </nav>
  );
}
