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

test('identifica al propietario de una empresa anterior y lo conserva al recargar', async ({
  page,
  baseURL,
}) => {
  let owner = null;
  await page
    .context()
    .addCookies([
      { name: 'evoria_access_token', value: 'test-only', url: baseURL },
    ]);
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api', '');
    const context = () => ({
      id: 't1',
      nit: '123-4',
      owner,
      emailDomain: null,
      sector: null,
      operationalDescription: null,
      eventTypes: [],
      operationMode: null,
      operationalAreas: [],
      operationalNotes: null,
    });
    let data;
    if (path === '/auth/me')
      data = {
        scope: 'tenant',
        isDeveloper: true,
        user: { id: 'u1', name: 'Desarrollador', email: 'dev@example.test' },
        profile: { name: 'Administrador' },
        tenant: { id: 't1', name: 'Empresa de prueba' },
        permissions: [
          'empresa_contexto.ver',
          'empresa_contexto.editar',
          'usuarios.ver',
        ],
      };
    else if (path === '/tenants/context' && request.method() === 'GET')
      data = context();
    else if (path === '/users')
      data = {
        items: [
          {
            id: 'u2',
            name: 'Ana Dueña',
            email: 'ana@example.test',
            status: 'activo',
          },
        ],
        pagination: { totalPages: 1 },
      };
    else if (
      path === '/tenants/context/owner' &&
      request.method() === 'PATCH'
    ) {
      expect(request.postDataJSON()).toEqual({ userId: 'u2' });
      owner = {
        id: 'u2',
        name: 'Ana Dueña',
        lastName: null,
        email: 'ana@example.test',
      };
      data = context();
    } else
      return route.fulfill({ status: 403, json: { message: 'Sin permiso' } });
    return route.fulfill({
      status: 200,
      headers: {
        'access-control-allow-origin': baseURL,
        'access-control-allow-credentials': 'true',
      },
      json: { data },
    });
  });
  await page.goto('/empresas');
  const card = page.getByRole('region', {
    name: 'Información del propietario',
  });
  await expect(card.getByText('123-4')).toBeVisible();
  await card.getByRole('button', { name: 'Identificar propietario' }).click();
  await card.getByLabel('Propietario', { exact: true }).selectOption('u2');
  await card.getByRole('button', { name: 'Asignar propietario' }).click();
  await page
    .getByTestId('feedback-modal')
    .getByRole('button', { name: 'Asignar propietario' })
    .click();
  await expect(card.getByText('ana@example.test')).toBeVisible();
  await page.reload();
  await expect(card.getByText('Ana Dueña')).toBeVisible();
  await expect(card.getByText('ana@example.test')).toBeVisible();
});
