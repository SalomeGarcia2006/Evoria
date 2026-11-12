import { test, expect } from '@playwright/test';

async function setup(page, baseURL, options = {}) {
  const calls = [];
  await page
    .context()
    .addCookies([{ name: 'evoria_access_token', value: 'test', url: baseURL }]);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api', '');
    calls.push(path);
    const pagination = { page: 1, limit: 100, total: 2, totalPages: 1 };
    let data;
    if (path === '/auth/me')
      data = {
        scope: 'tenant',
        user: { id: 'u1', name: 'QA', email: 'qa@example.test' },
        profile: { name: 'QA' },
        tenant: { id: 't1', name: 'Empresa' },
        permissions: options.permissions ?? [
          'reportes.ver',
          'eventos.ver',
          'inventario.ver',
          'presupuestos.ver',
        ],
      };
    else if (path === '/events')
      data = {
        items: [
          {
            id: 'e1',
            name: 'Feria de Innovación',
            status: 'planificado',
            startAt: '2026-12-05T15:00:00Z',
            location: 'Bogotá',
          },
          {
            id: 'e2',
            name: 'Evento pendiente',
            status: 'borrador',
            startAt: '2026-12-06T15:00:00Z',
            location: null,
          },
        ],
        pagination,
      };
    else if (path === '/inventory')
      data = {
        items: [
          {
            id: 'r1',
            status: 'disponible',
            totalQuantity: 100,
            availableQuantity: 76,
            reservedQuantity: 20,
          },
          {
            id: 'r2',
            status: 'mantenimiento',
            totalQuantity: 4,
            availableQuantity: 0,
            reservedQuantity: 0,
          },
        ],
        pagination,
      };
    else if (path === '/budgets')
      data = {
        items: [
          {
            eventId: 'e1',
            eventName: 'Feria de Innovación',
            eventStatus: 'planificado',
            initialized: true,
            allocatedCop: 1000000,
            spentCop: 400000,
            remainingCop: 600000,
          },
          {
            eventId: 'e2',
            eventName: 'Evento pendiente',
            eventStatus: 'borrador',
            initialized: false,
            allocatedCop: 0,
            spentCop: 0,
            remainingCop: 0,
          },
        ],
        totals: {
          allocatedCop: 1000000,
          spentCop: 400000,
          remainingCop: 600000,
        },
        pagination,
      };
    else return route.fulfill({ status: 404, body: '{}' });
    return route.fulfill({
      status: 200,
      headers: {
        'access-control-allow-origin': baseURL,
        'access-control-allow-credentials': 'true',
      },
      contentType: 'application/json',
      body: JSON.stringify({ data }),
    });
  });
  return calls;
}

test('reportes muestra resúmenes y detalles reales en ambos temas', async ({
  page,
  baseURL,
}) => {
  const calls = await setup(page, baseURL);
  await page.goto('/reportes');
  const overview = page.getByRole('region', { name: 'Resumen operativo' });
  await expect(overview).toContainText('104');
  await expect(overview).toContainText('76');
  await expect(overview).toContainText('600.000');
  const budgets = page.getByRole('region', {
    name: 'Reporte de presupuesto por evento',
  });
  const budget = budgets
    .locator('article')
    .filter({ hasText: 'Feria de Innovación' });
  await expect(budget.getByRole('progressbar')).toHaveAttribute(
    'aria-valuetext',
    '40 % ejecutado',
  );
  await expect(budget.getByRole('link')).toHaveAttribute(
    'href',
    '/presupuestos?eventId=e1',
  );
  await expect(
    budgets.locator('article').filter({ hasText: 'Evento pendiente' }),
  ).toContainText('Presupuesto inicial pendiente');
  const events = page.getByRole('region', { name: 'Reporte de eventos' });
  await expect(events).toContainText('Bogotá');
  await expect(
    events
      .locator('article')
      .filter({ hasText: 'Feria de Innovación' })
      .getByRole('link'),
  ).toHaveAttribute('href', '/eventos/e1');
  await page.getByRole('button', { name: 'Activar modo oscuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(budget.getByRole('progressbar')).toBeVisible();
  expect(calls).toEqual(
    expect.arrayContaining(['/events', '/inventory', '/budgets']),
  );
});

test('reportes respeta permisos y no consulta módulos no autorizados', async ({
  page,
  baseURL,
}) => {
  const calls = await setup(page, baseURL, {
    permissions: ['reportes.ver', 'eventos.ver'],
  });
  await page.goto('/reportes');
  await expect(
    page.getByRole('heading', { name: 'Actividad de eventos' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Uso de recursos' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Ejecución presupuestal' }),
  ).toHaveCount(0);
  expect(calls).not.toContain('/inventory');
  expect(calls).not.toContain('/budgets');
});
