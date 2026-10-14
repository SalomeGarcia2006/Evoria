const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.API_INTERNAL_URL ??
  'http://localhost:3001/api';

export async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, options);

  if (!response.ok) {
    throw new Error(`La API respondió con ${response.status}`);
  }

  return (await response.json()) as T;
}
