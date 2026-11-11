import { test, expect } from '@playwright/test';

for (const [path, button, content] of [
  ['/dashboard', 'Actualizar datos', 'Unidades disponibles'],
  [
    '/recursos/asignaciones',
    'Actualizar eventos',
    'Ver asignaciones de Evento de prueba',
  ],
  ['/presupuestos', 'Actualizar', 'Ver presupuesto de Evento de prueba'],
  ['/reportes', 'Actualizar', 'Eventos registrados'],
  ['/alertas', 'Actualizar', 'No hay alertas para los filtros seleccionados'],
]) {
  test(`mantiene la información de ${path} durante una actualización lenta`, async ({
    page,
    baseURL,
  }) => {
    const calls = new Map();
    await page
      .context()
      .addCookies([
        { name: 'evoria_access_token', value: 'test', url: baseURL },
      ]);
    await page.route('**/api/**', async (route) => {
      const endpoint = new URL(route.request().url()).pathname.replace(
        '/api',
        '',
      );
      const count = (calls.get(endpoint) ?? 0) + 1;
      calls.set(endpoint, count);
      if (endpoint !== '/auth/me' && count > 1)
        await new Promise((resolve) => setTimeout(resolve, 900));
      const event = {
        id: 'e1',
        name: 'Evento de prueba',
        status: 'planificado',
        startAt: '2026-12-05T15:00:00Z',
        endAt: '2026-12-06T02:00:00Z',
      };
      const pagination = { page: 1, limit: 100, total: 1, totalPages: 1 };
      let data = [];
      if (endpoint === '/auth/me')
        data = {
          scope: 'tenant',
          user: { id: 'u1', name: 'QA', email: 'qa@example.test' },
          profile: { name: 'QA' },
          tenant: { id: 't1', name: 'Empresa' },
          permissions: [
            'dashboard.ver',
            'eventos.ver',
            'inventario.ver',
            'asignaciones.ver',
            'presupuestos.ver',
            'reportes.ver',
            'alertas.ver',
          ],
        };
      else if (endpoint === '/events') data = { items: [event], pagination };
      else if (endpoint === '/alerts') data = { items: [], pagination };
      else if (endpoint === '/alerts/unread-count') data = { count: 0 };
      else if (endpoint === '/dashboard/summary')
        data = {
          events: null,
          inventory: {
            resources: 1,
            total: 4,
            available: 4,
            reserved: 0,
            maintenance: 0,
          },
          budgets: null,
        };
      else if (endpoint === '/inventory')
        data = {
          items: [
            {
              id: 'i1',
              name: 'Sillas',
              type: 'Mobiliario',
              availableQuantity: 4,
              totalQuantity: 4,
              reservedQuantity: 0,
              status: 'disponible',
              unitCost: 100,
            },
          ],
          pagination,
        };
      else if (endpoint === '/budgets')
        data = {
          items: [
            {
              eventId: 'e1',
              eventName: event.name,
              eventStatus: 'planificado',
              initialized: true,
              allocatedCop: 1000,
              spentCop: 100,
              remainingCop: 900,
            },
          ],
          totals: { allocatedCop: 1000, spentCop: 100, remainingCop: 900 },
          pagination,
        };
      await route.fulfill({
        status: 200,
        headers: {
          'access-control-allow-origin': baseURL,
          'access-control-allow-credentials': 'true',
          'access-control-allow-headers': 'content-type',
        },
        contentType: 'application/json',
        body: JSON.stringify({ data }),
      });
    });
    await page.goto(path);
    const item = content.startsWith('Ver ')
      ? page.getByRole('button', { name: content })
      : page.getByText(content, { exact: true }).first();
    await expect(item).toBeVisible();
    await page.getByRole('button', { name: button, exact: true }).click();
    await expect(item).toBeVisible({ timeout: 300 });
    await page.waitForTimeout(350);
    await expect(item).toBeVisible({ timeout: 300 });
  });
}
