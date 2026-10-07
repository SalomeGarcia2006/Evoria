import type { HealthResponse } from '@evoria/contracts';

const apiUrl =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001/api';

async function getApiHealth(): Promise<HealthResponse | null> {
  try {
    const response = await fetch(`${apiUrl}/health`, { cache: 'no-store' });

    if (!response.ok) return null;
    return (await response.json()) as HealthResponse;
  } catch {
    return null;
  }
}

export default async function Home() {
  const health = await getApiHealth();

  return (
    <main className="mx-auto grid min-h-screen max-w-3xl content-center px-8 py-12">
      <p className="text-xs font-bold tracking-[0.16em] text-teal">
        NEXT.JS + NESTJS
      </p>
      <h1 className="my-2 text-5xl font-bold tracking-[-0.07em] sm:text-7xl">
        EVORIA está listo.
      </h1>
      <p className="max-w-2xl text-lg leading-relaxed text-teal">
        Frontend y API conectados dentro de un monorepo con tipos compartidos.
      </p>
      <section
        className={`mt-10 flex items-center gap-4 rounded-2xl border p-5 ${
          health ? 'border-teal bg-white' : 'border-navy bg-sky-blue'
        }`}
      >
        <span
          aria-hidden="true"
          className={`size-3 rounded-full ${
            health
              ? 'bg-teal shadow-[0_0_1rem_var(--color-teal)]'
              : 'bg-navy'
          }`}
        />
        <div>
          <strong className="block">
            {health ? 'API conectada' : 'API no disponible'}
          </strong>
          <p className="mt-1 text-sm text-teal">
            {health
              ? `Estado: ${health.status} · ${new Date(health.timestamp).toLocaleString('es-CO')}`
              : 'Inicia el backend con npm run dev para completar la conexión.'}
          </p>
        </div>
      </section>
    </main>
  );
}
