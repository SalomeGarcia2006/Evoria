import { test, expect } from '@playwright/test';

async function setup(page, baseURL, options = {}) {
  const calls = [];
  let active = 7;
  let failed = options.failed ?? false;
  await page
    .context()
    .addCookies([{ name: 'evoria_access_token', value: 'test', url: baseURL }]);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api', '');
    calls.push(path);
    const headers = {
      'access-control-allow-origin': baseURL,
      'access-control-allow-credentials': 'true',
    };
    let data;
    if (path === '/auth/me')
      data = {
        scope: 'tenant',
        user: { id: 'u1', name: 'QA', email: 'qa@example.test' },
        profile: { name: 'QA' },
        tenant: { id: 't1', name: 'Empresa' },
        permissions: options.permissions ?? [
          'dashboard.ver',
          'eventos.ver',
          'inventario.ver',
          'presupuestos.ver',
        ],
      };
    else if (path === '/dashboard/summary') {
      if (failed)
        return route.fulfill({
          status: 503,
          headers,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Resumen no disponible' }),
        });
      data = {
        events: {
          total: 10,
          active,
          byStatus: {
            borrador: 1,
            planificado: 4,
            en_progreso: 2,
            finalizado: 2,
            cancelado: 1,
          },
          upcoming: [
            {
              id: 'e1',
              name: 'Próximo evento',
              startAt: '2099-12-05T15:00:00Z',
              endAt: '2099-12-06T02:00:00Z',
              status: 'planificado',
            },
          ],
        },
        inventory: options.hideInventory
          ? null
          : {
              resources: 3,
              total: 100,
              available: 76,
              reserved: 20,
              maintenance: 1,
            },
        budgets: options.hideBudgets
          ? null
          : { allocatedCop: 100000, spentCop: 34500, remainingCop: 65500 },
      };
    } else if (path === '/budgets')
      data = {
        items: [],
        totals: { allocatedCop: 1, spentCop: 2, remainingCop: 3 },
        pagination: { totalPages: 1 },
      };
    else
      return route.fulfill({
        status: 404,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Ruta no esperada' }),
      });
    return route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify({ data }),
    });
  });
  return {
    calls,
    changeActive: (value) => {
      active = value;
    },
    recover: () => {
      failed = false;
    },
  };
}

test('el botón de actualización es legible en modo claro y oscuro', async ({
  page,
  baseURL,
}) => {
  await page.addInitScript(() => localStorage.setItem('evoria-theme', 'light'));
  await setup(page, baseURL);
  await page.goto('/dashboard');
  const button = page.getByRole('button', { name: 'Actualizar datos' });
  await expect(button).toBeEnabled();
  await expect(button).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(button).toHaveCSS('color', 'rgb(57, 33, 132)');
  await page.getByRole('button', { name: 'Activar modo oscuro' }).click();
  await expect(button).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(button).toHaveCSS('color', 'rgb(57, 33, 132)');
});

test('dashboard usa las métricas del resumen del backend y las actualiza', async ({
  page,
  baseURL,
}) => {
  const state = await setup(page, baseURL);
  await page.goto('/dashboard');
  const metrics = page.getByRole('region', { name: 'Métricas principales' });
  await expect(
    metrics.getByRole('link', { name: /Eventos activos/ }),
  ).toContainText('7');
  await expect(
    metrics.getByRole('link', { name: /Unidades disponibles/ }),
  ).toContainText('76');
  await expect(
    metrics.getByRole('link', { name: /Presupuesto ejecutado/ }),
  ).toContainText('34.500');
  await expect(page.getByText('Próximo evento')).toBeVisible();
  expect(state.calls).not.toContain('/events');
  expect(state.calls).not.toContain('/inventory');
  state.changeActive(8);
  await page.getByRole('button', { name: 'Actualizar datos' }).click();
  await expect(
    metrics.getByRole('link', { name: /Eventos activos/ }),
  ).toContainText('8');
  await expect(page.getByRole('alertdialog')).toContainText(
    'actualizado correctamente',
  );
});

test('dashboard respeta bloques no autorizados y no consulta presupuestos sin permiso', async ({
  page,
  baseURL,
}) => {
  const state = await setup(page, baseURL, {
    permissions: ['dashboard.ver', 'eventos.ver'],
    hideInventory: true,
    hideBudgets: true,
  });
  await page.goto('/dashboard');
  await expect(page.getByText('Eventos activos')).toBeVisible();
  await expect(page.getByText('Unidades disponibles')).toHaveCount(0);
  await expect(page.getByText('Presupuesto ejecutado')).toHaveCount(0);
  expect(state.calls).not.toContain('/budgets');
});

test('dashboard muestra un error recuperable cuando falla el resumen', async ({
  page,
  baseURL,
}) => {
  const state = await setup(page, baseURL, {
    failed: true,
    permissions: ['dashboard.ver'],
  });
  await page.goto('/dashboard');
  const alert = page.getByRole('alertdialog');
  await expect(alert).toContainText('Resumen no disponible');
  await alert.getByRole('button', { name: 'Entendido' }).click();
  state.recover();
  await page.getByRole('button', { name: 'Actualizar datos' }).click();
  await expect(page.getByText('Eventos activos')).toBeVisible();
});
