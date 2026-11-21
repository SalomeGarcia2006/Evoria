import { test, expect } from '@playwright/test';

test('la guía explica las asignaciones del evento sin modificar recursos ni servicios', async ({
  page,
  baseURL,
}) => {
  let writes = 0;
  const event = {
    id: 'tour-event',
    name: 'Evento de ejemplo',
    status: 'planificado',
    startAt: '2026-12-05T15:00:00Z',
    endAt: '2026-12-06T02:00:00Z',
  };
  await page
    .context()
    .addCookies([{ name: 'evoria_access_token', value: 'test', url: baseURL }]);
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api', '');
    if (request.method() !== 'GET') writes += 1;
    let data = [];
    if (path === '/auth/me') {
      data = {
        scope: 'tenant',
        user: {
          id: 'assignments-guide-user',
          name: 'Usuario',
          email: 'tour@example.test',
        },
        profile: { name: 'Operador' },
        tenant: { id: 't1', name: 'Empresa' },
        permissions: [
          'eventos.ver',
          'asignaciones.ver',
          'asignaciones.crear',
          'inventario.ver',
          'presupuestos.ver',
        ],
      };
    } else if (path === '/events') {
      data = { items: [event], pagination: { totalPages: 1 } };
    } else if (path === '/events/tour-event') {
      data = event;
    } else if (path === '/events/tour-event/budget') {
      data = { initialized: true };
    } else if (path === '/inventory') {
      data = {
        items: [
          {
            id: 'i1',
            name: 'Sillas',
            type: 'Mobiliario',
            availableQuantity: 4,
          },
        ],
        pagination: { totalPages: 1 },
      };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data }),
    });
  });
  await page.goto('/recursos/asignaciones');
  const tour = page.locator('.driver-popover');
  await expect(tour).toContainText('Conoce Asignación de recursos');
  for (const title of [
    'Actualizar eventos',
    'Elegir un evento',
    'Ver inventario',
    'Todo listo',
  ]) {
    await tour.getByRole('button', { name: 'Siguiente' }).click();
    await expect(tour).toContainText(title, { timeout: 10000 });
  }
  await tour.getByRole('button', { name: 'Finalizar' }).click();
  await expect(tour).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem(
          'evoria-module-tour:assignments-guide-user:/recursos/asignaciones',
        ),
      ),
    )
    .toBe('done');

  await page.goto('/recursos/asignaciones/tour-event');
  await expect(tour).toContainText('Conoce Detalle de asignaciones');
  for (const title of [
    'Evento seleccionado',
    'Reservas y servicios',
    'Asignar recursos',
    'Detalle del evento',
    'Actualizar evento',
    'Reservas de inventario',
    'Seleccionar recurso',
    'Cantidad',
    'Asignar recurso',
    'Cerrar evento',
    'Todo listo',
  ]) {
    await tour.getByRole('button', { name: 'Siguiente' }).click();
    await expect(tour).toContainText(title, { timeout: 10000 });
    if (title === 'Detalle del evento') {
      await expect(
        page.locator('dialog[open] .grid.min-w-0.gap-6').first(),
      ).toHaveClass(/driver-active-element/);
    }
  }
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await tour.getByRole('button', { name: 'Anterior' }).click();
  await expect(tour).toContainText('Cerrar evento');
  await tour.getByRole('button', { name: 'Omitir tutorial' }).click();
  await expect(tour).toHaveCount(0);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem(
          'evoria-module-tour:assignments-guide-user:/recursos/asignaciones/[eventId]',
        ),
      ),
    )
    .toBe('done');
  await page.goto('/recursos/asignaciones');
  await page.waitForTimeout(1200);
  await expect(tour).toHaveCount(0);
  expect(writes).toBe(0);
});

test('la guía omite las acciones que el perfil no puede utilizar', async ({
  page,
  baseURL,
}) => {
  const event = {
    id: 'readonly-event',
    name: 'Evento de consulta',
    status: 'planificado',
    startAt: '2026-12-05T15:00:00Z',
    endAt: '2026-12-06T02:00:00Z',
  };
  await page
    .context()
    .addCookies([{ name: 'evoria_access_token', value: 'test', url: baseURL }]);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api', '');
    let data = [];
    if (path === '/auth/me') {
      data = {
        scope: 'tenant',
        user: {
          id: 'readonly-guide-user',
          name: 'Usuario',
          email: 'tour@example.test',
        },
        profile: { name: 'Consulta' },
        tenant: { id: 't1', name: 'Empresa' },
        permissions: ['eventos.ver', 'asignaciones.ver'],
      };
    } else if (path === '/events') {
      data = { items: [event], pagination: { totalPages: 1 } };
    } else if (path === '/events/readonly-event') {
      data = event;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data }),
    });
  });
  await page.goto('/recursos/asignaciones');
  const tour = page.locator('.driver-popover');
  await expect(tour).toContainText('Conoce Asignación de recursos');
  for (const title of [
    'Actualizar eventos',
    'Elegir un evento',
    'Todo listo',
  ]) {
    await tour.getByRole('button', { name: 'Siguiente' }).click();
    await expect(tour).toContainText(title, { timeout: 10000 });
  }
  await tour.getByRole('button', { name: 'Finalizar' }).click();
  await page.goto('/recursos/asignaciones/readonly-event');
  await expect(tour).toContainText('Conoce Detalle de asignaciones');
  for (const title of [
    'Evento seleccionado',
    'Reservas y servicios',
    'Todo listo',
  ]) {
    await tour.getByRole('button', { name: 'Siguiente' }).click();
    await expect(tour).toContainText(title, { timeout: 10000 });
  }
  await tour.getByRole('button', { name: 'Finalizar' }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});
