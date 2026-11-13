import { test, expect } from '@playwright/test';

test('el desarrollador puede volver a plataforma desde una empresa', async ({
  page,
  baseURL,
}) => {
  let inTenant = true;
  const calls = [];
  const session = () => ({
    scope: inTenant ? 'tenant' : 'platform',
    isDeveloper: true,
    user: { id: 'u1', name: 'Desarrollador', email: 'dev@example.test' },
    profile: { name: inTenant ? 'Administrador' : 'Desarrollador' },
    ...(inTenant ? { tenant: { id: 't1', name: 'Empresa de prueba' } } : {}),
    permissions: inTenant ? ['dashboard.ver'] : ['empresas.ver'],
  });
  await page
    .context()
    .addCookies([
      { name: 'evoria_access_token', value: 'test-only', url: baseURL },
    ]);
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api', '');
    calls.push(`${request.method()} ${path}`);
    let data;
    if (path === '/auth/me') data = session();
    else if (path === '/tenants/leave' && request.method() === 'POST') {
      inTenant = false;
      data = session();
    } else if (path === '/tenants' && !inTenant)
      data = [
        { id: 't1', name: 'Empresa de prueba', nit: '123', status: 'activo' },
      ];
    else
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Sin permiso' }),
      });
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
  await page.goto('/empresas');
  await expect(
    page.getByRole('link', { name: 'Empresas', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Empresa de prueba')).toBeVisible();
  expect(calls).not.toContain('GET /tenants');
  await page.getByRole('button', { name: 'Salir de la empresa' }).click();
  await expect(
    page.getByText('Estás en tu sesión de Desarrollador.', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('article', { name: 'Empresa Empresa de prueba' }),
  ).toBeVisible();
  expect(calls).toContain('POST /tenants/leave');
});
