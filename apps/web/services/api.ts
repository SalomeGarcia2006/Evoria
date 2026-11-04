const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.API_INTERNAL_URL ??
  'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly messages: string[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function apiErrorMessage(error: unknown): string {
  if (!(error instanceof Error))
    return 'No se pudo completar la operación. Intenta de nuevo.';
  if (!(error instanceof ApiError)) return error.message;
  const hint =
    error.status === 403
      ? 'No tienes permiso para realizar esta acción.'
      : error.status === 404
        ? 'El registro no existe o no está disponible para tu empresa.'
        : error.status === 409
          ? /presupuesto inicial/i.test(error.message)
            ? 'Inicia el presupuesto desde el detalle del evento antes de asignar recursos o servicios.'
            : /saldo|presupuesto disponible/i.test(error.message)
              ? 'Revisa el disponible y solicita una ampliación de presupuesto si necesitas más saldo.'
              : /ya fue decidida/i.test(error.message)
                ? 'Consulta el historial para ver la decisión registrada.'
                : /cancelado/i.test(error.message)
                  ? 'Puedes consultar el historial y cancelar acuerdos existentes; no crear ni editar.'
                  : 'Actualiza los datos antes de volver a intentarlo.'
          : '';
  return [error.message, hint].filter(Boolean).join(' ');
}

export function apiFieldErrors(
  error: unknown,
  fields: Record<string, RegExp>,
): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  const result: Record<string, string> = {};
  for (const [field, pattern] of Object.entries(fields)) {
    if (error.messages.some((message) => pattern.test(message)))
      result[field] = error.message;
  }
  return result;
}

export async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, options);

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message;

    throw new ApiError(
      response.status,
      message ?? `La API respondió con ${response.status}`,
      Array.isArray(body?.message)
        ? body.message
        : body?.message
          ? [body.message]
          : [],
    );
  }

  return (await response.json()) as T;
}
