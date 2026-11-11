import { test, expect } from '@playwright/test';

test('inventario conserva los controles claros y admite modo oscuro', async ({
  page,
  baseURL,
}) => {
  await page.addInitScript(() => localStorage.setItem('evoria-theme', 'light'));
  await page
    .context()
    .addCookies([{ name: 'evoria_access_token', value: 'test', url: baseURL }]);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api', '');
    let data = [];
    if (path === '/auth/me')
      data = {
        scope: 'tenant',
        user: { id: 'u1', name: 'QA', email: 'qa@example.test' },
        profile: { name: 'QA' },
        tenant: { id: 't1', name: 'Empresa' },
        permissions: ['inventario.ver', 'inventario.ajustar'],
      };
    else if (path === '/inventory')
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
        pagination: { totalPages: 1 },
      };
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': baseURL,
        'access-control-allow-credentials': 'true',
      },
      body: JSON.stringify({ data }),
    });
  });
  await page.goto('/inventario');
  await expect(page.getByText('Sillas', { exact: true })).toBeVisible();
  const scope = page.locator('[data-inventory-scope]');
  const create = scope.getByRole('button', { name: 'Nuevo recurso' });
  await expect(create).toHaveCSS(
    'background-image',
    /rgb\(18, 181, 166\).*rgb\(106, 76, 255\)/,
  );
  const search = scope.getByRole('searchbox', { name: 'Buscar recurso' });
  await expect(search).toHaveCSS('border-top-color', 'rgb(227, 232, 243)');
  await page.getByRole('button', { name: 'Activar modo oscuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(create).toHaveCSS(
    'background-image',
    /rgb\(8, 121, 111\).*rgb\(96, 66, 187\)/,
  );
  await expect(page.getByText('Sillas', { exact: true })).toBeVisible();
});
