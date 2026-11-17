import { test, expect } from '@playwright/test';

test('la guía abre el formulario, permite volver y lo cierra al omitir sin guardar', async ({
  page,
  baseURL,
}) => {
  let writes = 0;
  await page
    .context()
    .addCookies([{ name: 'evoria_access_token', value: 'test', url: baseURL }]);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api', '');
    if (route.request().method() !== 'GET') writes += 1;
    let data = [];
    if (path === '/auth/me') {
      data = {
        scope: 'tenant',
        user: {
          id: 'interactive-tour',
          name: 'Usuario',
          email: 'tour@example.test',
        },
        profile: { name: 'Operador' },
        tenant: { id: 't1', name: 'Empresa' },
        permissions: ['proveedores.ver', 'proveedores.crear'],
      };
    } else if (path === '/providers') {
      data = {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data }),
    });
  });
  await page.goto('/proveedores');
  const tour = page.locator('.driver-popover');
  await expect(tour).toContainText('Conoce Proveedores');
  for (const title of [
    'Buscar proveedores',
    'Filtrar categorías',
    'Directorio',
    'Crear proveedor',
  ]) {
    await tour.getByRole('button', { name: 'Siguiente' }).click();
    await expect(tour).toContainText(title);
  }
  await tour.getByRole('button', { name: 'Siguiente' }).click();
  await expect(tour).toContainText('Nombre');
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await tour.getByRole('button', { name: 'Anterior' }).click();
  await expect(tour).toContainText('Crear proveedor');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await tour.getByRole('button', { name: 'Siguiente' }).click();
  await expect(tour).toContainText('Nombre');
  await tour.getByRole('button', { name: 'Omitir tutorial' }).click();
  await expect(tour).toHaveCount(0);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(writes).toBe(0);
});

test('la guía de eventos permite avanzar, regresar y omitir desde el calendario', async ({
  page,
  baseURL,
}) => {
  let writes = 0;
  await page
    .context()
    .addCookies([{ name: 'evoria_access_token', value: 'test', url: baseURL }]);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api', '');
    if (route.request().method() !== 'GET') writes += 1;
    let data = [];
    if (path === '/auth/me') {
      data = {
        scope: 'tenant',
        user: {
          id: 'event-guide-calendar',
          name: 'Usuario',
          email: 'tour@example.test',
        },
        profile: { name: 'Operador' },
        tenant: { id: 't1', name: 'Empresa' },
        permissions: ['eventos.ver', 'eventos.crear'],
      };
    } else if (path === '/events') {
      data = {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data }),
    });
  });
  await page.goto('/eventos');
  const tour = page.locator('.driver-popover');
  await expect(tour).toContainText('Conoce Eventos');
  for (const title of [
    'Nuevo evento',
    'Nombre del evento',
    'Descripción',
    'Fechas y horas',
  ]) {
    await tour.getByRole('button', { name: 'Siguiente' }).click();
    await expect(tour).toContainText(title);
  }
  await expect(page.locator('.driver-active-element')).toHaveAttribute(
    'aria-label',
    'Seleccionar rango de fechas',
  );
  await tour.getByRole('button', { name: 'Siguiente' }).click();
  await expect(tour).toContainText('Tipo de evento');
  await tour.getByRole('button', { name: 'Anterior' }).click();
  await expect(tour).toContainText('Fechas y horas');
  await tour.getByRole('button', { name: 'Omitir tutorial' }).click();
  await expect(tour).toHaveCount(0);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(writes).toBe(0);
});
