import type { HealthResponse } from '@evoria/contracts';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

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
    <main>
      <p className="eyebrow">NEXT.JS + NESTJS</p>
      <h1>EVORIA está listo.</h1>
      <p className="description">
        Frontend y API conectados dentro de un monorepo con tipos compartidos.
      </p>
      <section className={health ? 'status online' : 'status offline'}>
        <span aria-hidden="true" />
        <div>
          <strong>{health ? 'API conectada' : 'API no disponible'}</strong>
          <p>
            {health
              ? `Estado: ${health.status} · ${new Date(health.timestamp).toLocaleString('es-CO')}`
              : 'Inicia el backend con npm run dev para completar la conexión.'}
          </p>
        </div>
      </section>
    </main>
  );
}
