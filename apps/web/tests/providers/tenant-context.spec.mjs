import { test, expect } from '@playwright/test';

async function setup(
  page,
  baseURL,
  {
    platform = false,
    permissions = ['empresa_contexto.ver', 'empresa_contexto.editar'],
  } = {},
) {
  const calls = [];
  let context = {
    id: 't1',
    sector: 'Eventos',
    operationalDescription: 'Organizamos eventos',
    eventTypes: ['Congresos'],
    operationMode: 'clientes',
    operationalAreas: [
      {
        name: 'Logística',
        description: 'Coordina recursos',
        responsibilities: ['Montaje'],
        authorizations: ['Reservar'],
      },
    ],
    operationalNotes: 'Nota',
  };
  let tenants = [
    {
      id: 't1',
      name: 'Empresa Uno',
      nit: '123',
      slug: 'empresa-uno',
      status: 'activo',
    },
  ];
  await page
    .context()
    .addCookies([{ name: 'evoria_access_token', value: 'test', url: baseURL }]);
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace('/api', '');
    calls.push({
      path,
      method: req.method(),
      body: req.method() === 'PATCH' ? req.postDataJSON() : undefined,
    });
    let data;
    if (path === '/auth/me')
      data = {
        scope: platform ? 'platform' : 'tenant',
        isDeveloper: platform,
        user: { id: 'u1', name: 'Usuario', email: 'u@example.test' },
        profile: { name: 'Perfil' },
        ...(!platform && { tenant: { id: 't1', name: 'Empresa Uno' } }),
        permissions,
      };
    else if (path === '/tenants/context' && req.method() === 'GET')
      data = context;
    else if (path === '/tenants/context' && req.method() === 'PATCH') {
      context = { ...context, ...req.postDataJSON() };
      data = context;
    } else if (path === '/tenants' && req.method() === 'GET') data = tenants;
    else if (path === '/tenants/t1' && req.method() === 'DELETE') {
      tenants = [];
      data = { id: 't1', status: 'inactivo' };
    } else
      return route.fulfill({ status: 404, json: { message: 'No encontrado' } });
    return route.fulfill({
      status: 200,
      headers: {
        'access-control-allow-origin': baseURL,
        'access-control-allow-credentials': 'true',
      },
      json: { data },
    });
  });
  return calls;
}

test('consulta y actualiza el contexto operativo de la empresa', async ({
  page,
  baseURL,
}) => {
  const calls = await setup(page, baseURL);
  await page.goto('/empresas');
  await expect(
    page.getByRole('link', { name: 'Empresas', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Sector')).toHaveValue('Eventos');
  await expect(page.getByLabel('Sector')).toBeDisabled();
  await page.getByRole('button', { name: 'Editar contexto' }).click();
  await page.getByRole('button', { name: 'Actualizar información' }).click();
  await expect(page.getByRole('alertdialog')).toContainText(
    'Modifica algún dato',
  );
  await page.getByRole('button', { name: 'Entendido' }).click();
  await page.getByLabel('Sector').fill('Cultura');
  await page.getByLabel('Tipos de eventos').fill('Conciertos\nFerias');
  await page.getByRole('button', { name: 'Añadir área' }).click();
  await page
    .getByRole('group', { name: 'Área 2' })
    .getByLabel('Nombre del área')
    .fill('Producción');
  await page.getByRole('button', { name: 'Actualizar información' }).click();
  await expect(page.getByRole('alertdialog')).toContainText(
    'contexto operativo se actualizó',
  );
  expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(1);
  const body = calls.find((call) => call.method === 'PATCH').body;
  expect(body.eventTypes).toEqual(['Conciertos', 'Ferias']);
  expect(body.operationalAreas[0].responsibilities).toEqual(['Montaje']);
  expect(body.operationalAreas[1].name).toBe('Producción');
  expect(body).not.toHaveProperty('operationMode');
});

test('solo lectura no permite editar y no realiza cambios', async ({
  page,
  baseURL,
}) => {
  const calls = await setup(page, baseURL, {
    permissions: ['empresa_contexto.ver'],
  });
  await page.goto('/empresas');
  await expect(page.getByLabel('Sector')).toHaveValue('Eventos');
  await expect(
    page.getByRole('button', { name: 'Editar contexto' }),
  ).toHaveCount(0);
  expect(calls.some((call) => call.method === 'PATCH')).toBe(false);
});

test('desactiva la empresa seleccionada solo tras confirmar', async ({
  page,
  baseURL,
}) => {
  const calls = await setup(page, baseURL, {
    platform: true,
    permissions: ['empresas.ver', 'empresas.desactivar'],
  });
  await page.goto('/empresas');
  await page.getByRole('button', { name: 'Desactivar Empresa Uno' }).click();
  const dialog = page.getByRole('dialog', { name: 'Desactivar empresa' });
  await expect(
    dialog.getByRole('button', { name: 'Confirmar' }),
  ).toBeDisabled();
  await dialog
    .getByLabel('Escribe DESACTIVAR para confirmar')
    .fill('DESACTIVAR');
  await dialog.getByRole('button', { name: 'Confirmar' }).click();
  await expect(
    page.getByText('La empresa se desactivó correctamente.'),
  ).toBeVisible();
  await expect(
    page.getByText('No hay empresas disponibles.', { exact: false }),
  ).toBeVisible();
  expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(1);
});
