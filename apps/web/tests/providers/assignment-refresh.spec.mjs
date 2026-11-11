import { test, expect } from '@playwright/test';

async function openAssignments(page, baseURL) {
  let eventCalls = 0;
  let mutationCalls = 0;
  let failRefresh = false;
  let assigned = false;
  const event = {
    id: 'e1',
    name: 'Evento de prueba',
    status: 'planificado',
    startAt: '2026-12-05T15:00:00Z',
    endAt: '2026-12-06T02:00:00Z',
  };
  const resource = {
    id: 'i1',
    name: 'Sillas',
    type: 'Mobiliario',
    availableQuantity: 4,
    totalQuantity: 4,
    reservedQuantity: 0,
    status: 'disponible',
    unitCost: 100,
  };
  const assignment = {
    id: 'a1',
    inventoryItemId: 'i1',
    quantity: 1,
    assignedAt: '2026-11-05T12:00:00Z',
    inventoryItem: resource,
  };
  await page
    .context()
    .addCookies([{ name: 'evoria_access_token', value: 'test', url: baseURL }]);
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api', '');
    const headers = {
      'access-control-allow-origin': baseURL,
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type',
    };
    let data = [];
    if (path === '/auth/me') {
      data = {
        scope: 'tenant',
        user: { id: 'u1', name: 'QA', email: 'qa@example.test' },
        profile: { name: 'QA' },
        tenant: { id: 't1', name: 'Empresa' },
        permissions: [
          'eventos.ver',
          'asignaciones.ver',
          'asignaciones.crear',
          'asignaciones.eliminar',
          'inventario.ver',
          'presupuestos.ver',
        ],
      };
    } else if (path === '/events') {
      data = { items: [event], pagination: { totalPages: 1 } };
    } else if (path === '/events/e1') {
      eventCalls++;
      if (failRefresh)
        return route.fulfill({
          status: 503,
          headers,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Fallo de prueba' }),
        });
      data = event;
    } else if (path === '/events/e1/budget') {
      data = { initialized: true };
    } else if (path === '/inventory') {
      data = { items: [resource], pagination: { totalPages: 1 } };
    } else if (path === '/events/e1/resources' && request.method() === 'POST') {
      mutationCalls++;
      assigned = true;
      data = assignment;
    } else if (
      path === '/events/e1/resources/i1' &&
      request.method() === 'DELETE'
    ) {
      mutationCalls++;
      assigned = false;
      data = assignment;
    } else if (path === '/events/e1/resources') {
      data = assigned ? [assignment] : [];
    }
    return route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify({ data }),
    });
  });
  await page.goto('/recursos/asignaciones');
  await page
    .getByRole('button', { name: 'Ver asignaciones de Evento de prueba' })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Asignaciones · Evento de prueba',
  });
  await expect(dialog.getByLabel('Recurso de inventario')).toBeVisible();
  return {
    dialog,
    eventCalls: () => eventCalls,
    mutationCalls: () => mutationCalls,
    fail: (value) => {
      failRefresh = value;
    },
  };
}

test('sin cambios muestra la validación y no vuelve a consultar el evento', async ({
  page,
  baseURL,
}) => {
  const app = await openAssignments(page, baseURL);
  const calls = app.eventCalls();
  await app.dialog.getByRole('button', { name: 'Actualizar evento' }).click();
  const alert = page.getByRole('alertdialog');
  await expect(alert.locator('.login-alert-modal')).toBeVisible();
  await expect(alert).toContainText(
    'Para actualizar el evento, primero debes añadir o liberar un recurso, o asignar un servicio.',
  );
  expect(app.eventCalls()).toBe(calls);
  expect(app.mutationCalls()).toBe(0);
  await alert.getByRole('button', { name: 'Entendido' }).click();
});

test('permite actualizar tras asignar o liberar un recurso y conserva errores', async ({
  page,
  baseURL,
}) => {
  const app = await openAssignments(page, baseURL);
  await app.dialog.getByLabel('Recurso de inventario').selectOption('i1');
  await app.dialog.getByRole('button', { name: 'Asignar recurso' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Entendido' })
    .click();
  await expect(
    app.dialog.getByRole('button', { name: 'Liberar recurso' }),
  ).toBeVisible();
  app.fail(true);
  await app.dialog.getByRole('button', { name: 'Actualizar evento' }).click();
  let alert = page.getByRole('alertdialog');
  await expect(alert).toContainText('Evento: Fallo de prueba');
  await alert.getByRole('button', { name: 'Entendido' }).click();
  app.fail(false);
  await app.dialog.getByRole('button', { name: 'Actualizar evento' }).click();
  await expect(alert.locator('.event-success-modal')).toBeVisible();
  await alert.getByRole('button', { name: 'Entendido' }).click();
  await app.dialog.getByRole('button', { name: 'Actualizar evento' }).click();
  await expect(alert.locator('.login-alert-modal')).toBeVisible();
  await alert.getByRole('button', { name: 'Entendido' }).click();
  await app.dialog.getByRole('button', { name: 'Liberar recurso' }).click();
  await expect(
    page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Liberar unidades' }),
  ).toBeDisabled();
  await page
    .getByRole('alertdialog')
    .getByLabel('Escribe LIBERAR para confirmar')
    .fill('LIBERAR');
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Liberar unidades' })
    .click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Entendido' })
    .click();
  await app.dialog.getByRole('button', { name: 'Actualizar evento' }).click();
  await expect(alert.locator('.event-success-modal')).toBeVisible();
  expect(app.mutationCalls()).toBe(2);
});
