import { test, expect } from '@playwright/test';

async function prepareSession(page, baseURL, userId, permissions) {
  await page
    .context()
    .addCookies([{ name: 'evoria_access_token', value: 'test', url: baseURL }]);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api', '');
    const headers = {
      'access-control-allow-origin': baseURL,
      'access-control-allow-credentials': 'true',
    };
    let data = [];
    if (path === '/auth/me') {
      data = {
        scope: 'tenant',
        user: { id: userId, name: 'Usuario', email: 'tour@example.test' },
        profile: { name: 'Operador' },
        tenant: { id: 't1', name: 'Empresa' },
        permissions,
      };
    } else if (path === '/events' || path === '/inventory') {
      data = {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      };
    }
    await route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify({ data }),
    });
  });
}

test('cada módulo muestra su guía una sola vez y permite omitirla', async ({
  page,
  baseURL,
}) => {
  await prepareSession(page, baseURL, 'tour-user', [
    'eventos.ver',
    'inventario.ver',
  ]);
  await page.goto('/eventos');
  const popover = page.locator('.driver-popover');
  await expect(popover).toContainText('Conoce Eventos');
  await popover.getByRole('button', { name: 'Siguiente' }).click();
  await expect(popover).toContainText('Todo listo');
  await popover.getByRole('button', { name: 'Omitir tutorial' }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem('evoria-module-tour:tour-user:/eventos'),
      ),
    )
    .toBe('done');
  await page.goto('/inventario');
  await expect(popover).toContainText('Conoce Inventario');
  await popover.getByRole('button', { name: 'Omitir tutorial' }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem('evoria-module-tour:tour-user:/inventario'),
      ),
    )
    .toBe('done');
  await page.goto('/eventos');
  await page.waitForTimeout(1200);
  await expect(popover).toHaveCount(0);
});

test('solo muestra el paso de creación cuando el perfil tiene permiso', async ({
  page,
  baseURL,
}) => {
  await prepareSession(page, baseURL, 'viewer-tour', ['eventos.ver']);
  await page.goto('/eventos');
  const popover = page.locator('.driver-popover');
  await expect(popover).toContainText('Conoce Eventos');
  await popover.getByRole('button', { name: 'Siguiente' }).click();
  await expect(popover).toContainText('Todo listo');
  await popover.getByRole('button', { name: 'Finalizar' }).click();
  await expect(popover).toHaveCount(0);
});

test('incluye la creación para quien tiene permiso', async ({
  page,
  baseURL,
}) => {
  await prepareSession(page, baseURL, 'creator-tour', [
    'eventos.ver',
    'eventos.crear',
  ]);
  await page.goto('/eventos');
  const popover = page.locator('.driver-popover');
  await expect(popover).toContainText('Conoce Eventos');
  await popover.getByRole('button', { name: 'Siguiente' }).click();
  await expect(popover).toContainText('Nuevo evento');
  await expect(page.locator('.driver-active-element')).toHaveText(
    /Nuevo evento/,
  );
});
