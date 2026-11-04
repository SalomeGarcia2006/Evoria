import { test, expect } from '@playwright/test';
import { acknowledgeFeedback } from './feedback.helpers.mjs';
const permissions = [
  'dashboard.ver',
  'inventario.ver',
  'inventario.ajustar',
  'asignaciones.ver',
  'asignaciones.crear',
  'asignaciones.eliminar',
  'eventos.ver',
  'presupuestos.ver',
  'presupuestos.editar',
  'alertas.ver',
  'reportes.ver',
];
async function setup(page) {
  const item = {
    id: 'i1',
    name: 'Sillas',
    type: 'Mobiliario',
    totalQuantity: 10,
    availableQuantity: 9,
    reservedQuantity: 1,
    unitCost: 100,
    status: 'disponible',
    description: '',
  };
  const event = {
    id: 'e1',
    name: 'Evento de prueba',
    baseBudget: 10000,
    startAt: '2026-12-05T15:00:00Z',
    endAt: '2026-12-06T02:00:00Z',
    status: 'planificado',
  };
  const state = {
    items: [item],
    assignments: [
      {
        id: 'a1',
        eventId: 'e1',
        inventoryItemId: 'i1',
        quantity: 1,
        status: 'asignado',
        assignedAt: '2026-11-01T15:00:00Z',
        inventoryItem: item,
      },
    ],
    calls: [],
    failSave: false,
    failEvents: false,
  };
  await page.context().addCookies([
    {
      name: 'evoria_access_token',
      value: 'test-only',
      url: 'http://localhost:3100',
    },
  ]);
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace('/api', '');
    const method = req.method();
    const headers = {
      'access-control-allow-origin': 'http://localhost:3100',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    };
    const send = (data) =>
      route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({ data }),
      });
    const error = (message) =>
      route.fulfill({
        status: 409,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({ message }),
      });
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const body = ['POST', 'PATCH'].includes(method)
      ? req.postDataJSON()
      : undefined;
    state.calls.push({ path, method, body });
    if (path === '/auth/me')
      return send({
        scope: 'tenant',
        user: { id: 'u1', name: 'Esthefany QA', email: 'qa@example.test' },
        profile: { name: 'QA' },
        tenant: { id: 't1', name: 'Empresa QA' },
        permissions,
      });
    if (path === '/events')
      return state.failEvents
        ? error('No se pudieron consultar los eventos.')
        : send({ items: [event], pagination: { totalPages: 1 } });
    if (path === '/events/e1') return send(event);
    const amounts = {
      baseAmountCop: 10000,
      approvedIncreaseCop: 0,
      inventorySpentCop: 100,
      providerSpentCop: 0,
      extraSpentCop: 0,
      allocatedCop: 10000,
      spentCop: 100,
      remainingCop: 9900,
    };
    const budget = {
      eventId: 'e1',
      eventName: event.name,
      eventStatus: 'planificado',
      initialized: true,
      ...amounts,
    };
    if (path === '/budgets')
      return send({
        items: [budget],
        totals: { allocatedCop: 10000, spentCop: 100, remainingCop: 9900 },
        pagination: { page: 1, total: 1, totalPages: 1 },
      });
    if (path === '/events/e1/budget')
      return send({
        ...budget,
        inventoryLines: [],
        providerLines: [],
        requests: [],
      });
    if (path === '/inventory' && method === 'GET') {
      const items = state.items.filter((item) => item.status !== 'inactivo');
      return send({
        items,
        pagination: { page: 1, total: items.length, totalPages: 1 },
      });
    }
    if (['POST', 'PATCH', 'DELETE'].includes(method) && state.failSave)
      return error('No fue posible guardar. Intenta nuevamente.');
    if (path === '/inventory' && method === 'POST') {
      const created = {
        ...body,
        id: 'i2',
        reservedQuantity: 0,
        availableQuantity: body.totalQuantity,
      };
      state.items.push(created);
      return send(created);
    }
    if (path.startsWith('/inventory/')) {
      const resource = state.items.find((item) => path.endsWith(`/${item.id}`));
      if (method === 'PATCH') Object.assign(resource, body);
      if (method === 'DELETE') resource.status = 'inactivo';
      return send(resource);
    }
    if (path === '/events/e1/resources' && method === 'GET')
      return send(state.assignments);
    if (path === '/events/e1/resources/i1' && method === 'DELETE') {
      state.assignments = [];
      return send({});
    }
    return error(`Ruta inesperada: ${method} ${path}`);
  });
  return state;
}

test('dashboard: éxito y error en ventanas centradas que esperan confirmación', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/dashboard');
  await expect(
    page.getByRole('button', { name: 'Actualizar', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
  const modal = page.getByTestId('feedback-modal');
  await expect(modal.locator('.event-success-modal')).toBeVisible();
  await expect(modal).toContainText('actualizado correctamente');
  await page.clock.install();
  await page.clock.runFor(15000);
  await expect(modal).toBeVisible();
  await acknowledgeFeedback(page);
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await acknowledgeFeedback(page, 'actualizado correctamente');
  state.failEvents = true;
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await expect(modal.locator('.login-alert-modal')).toBeVisible();
  await expect(modal.getByRole('alert')).toContainText(
    'No se pudo completar el resumen',
  );
  await page.screenshot({
    path: test.info().outputPath('error-dashboard.png'),
    fullPage: true,
  });
  await acknowledgeFeedback(page);
});

test('recursos: campos obligatorios, error sin pérdida de datos y éxitos con estilo de Eventos', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/inventario');
  await page.getByRole('button', { name: /Nuevo recurso/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Nombre del recurso')).toHaveAttribute(
    'required',
    '',
  );
  await dialog.getByRole('button', { name: 'Guardar recurso' }).click();
  await expect(
    page.getByRole('alertdialog').locator('.login-alert-modal'),
  ).toBeVisible();
  await acknowledgeFeedback(page, 'Completa el nombre y el tipo');
  await dialog.getByLabel('Nombre del recurso').fill('Mesas');
  await dialog.getByLabel('Tipo', { exact: true }).fill('Mobiliario');
  await dialog.getByLabel('Cantidad total').fill('3');
  await dialog.getByLabel('Costo unitario (COP)').fill('200');
  state.failSave = true;
  await dialog.getByRole('button', { name: 'Guardar recurso' }).click();
  await expect(
    page.getByRole('alertdialog').locator('.login-alert-modal'),
  ).toBeVisible();
  await acknowledgeFeedback(page, 'No fue posible guardar');
  await expect(dialog.getByLabel('Nombre del recurso')).toHaveValue('Mesas');
  await expect(dialog.getByLabel('Cantidad total')).toHaveValue('3');
  state.failSave = false;
  await dialog.getByRole('button', { name: 'Guardar recurso' }).click();
  await expect(
    page.getByRole('alertdialog').locator('.event-success-modal'),
  ).toBeVisible();
  await acknowledgeFeedback(page, 'Recurso creado correctamente');
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole('row')
    .filter({ hasText: 'Mesas' })
    .getByRole('button', { name: /Ver detalle/ })
    .click();
  await dialog.getByRole('button', { name: 'Editar recurso' }).click();
  await dialog.getByLabel('Nombre del recurso').fill('Mesas grandes');
  await dialog.getByRole('button', { name: 'Guardar recurso' }).click();
  await acknowledgeFeedback(page, 'actualizado correctamente');
  await dialog
    .getByRole('button', { name: 'Desactivar recurso', exact: true })
    .click();
  await dialog.getByRole('button', { name: 'Confirmar desactivación' }).click();
  await expect(
    page.getByRole('alertdialog').locator('.event-success-modal'),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath('exito-recurso.png'),
    fullPage: true,
  });
  await acknowledgeFeedback(page, 'desactivado correctamente');
});

test('asignaciones: paso previo, confirmación y ventana de éxito al liberar', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/recursos/asignaciones');
  await page.getByRole('button', { name: 'Qué necesito para asignar' }).click();
  await acknowledgeFeedback(page, 'Selecciona un evento');
  await page.getByLabel('Evento', { exact: true }).selectOption('e1');
  await page
    .getByRole('button', { name: 'Liberar recurso', exact: true })
    .click();
  await expect(page.getByRole('alertdialog')).toContainText(
    'gasto histórico permanecerá',
  );
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Volver' })
    .click();
  expect(state.assignments).toHaveLength(1);
  await page
    .getByRole('button', { name: 'Liberar recurso', exact: true })
    .click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Liberar unidades' })
    .click();
  await acknowledgeFeedback(page, 'Recurso liberado');
  expect(state.assignments).toHaveLength(0);
});

test('alertas y reportes: orientación sin funciones simuladas y cierre accesible', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/alertas');
  await page
    .getByRole('button', { name: 'Cómo revisar autorizaciones' })
    .click();
  await expect(
    page.getByRole('alertdialog').locator('.login-alert-modal'),
  ).toBeVisible();
  await expect(page.getByRole('alertdialog')).toContainText(
    'Solicita al administrador',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Cómo revisar autorizaciones' }),
  ).toBeFocused();
  await page.goto('/reportes');
  await page
    .getByRole('button', { name: 'Cómo consultar esta información' })
    .first()
    .click();
  await acknowledgeFeedback(page, 'aún no se puede generar ni descargar');
  expect(state.calls.filter((call) => /report/.test(call.path))).toHaveLength(
    0,
  );
});

test('presupuestos: pide seleccionar un evento y no muestra la calculadora', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/presupuestos');
  await expect(
    page.getByRole('heading', { name: 'Eventos activos', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Calculadora de presupuesto', { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('dl')).toHaveCount(0);
  expect(
    state.calls.filter((call) =>
      ['POST', 'PATCH', 'DELETE'].includes(call.method),
    ),
  ).toHaveLength(0);
});

test('eventos conserva su detalle anterior al PR, sin panel ni consultas de presupuesto', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/eventos/e1');
  await expect(
    page.getByRole('heading', { name: 'Evento de prueba', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('table').getByText('Sillas', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Presupuesto del evento', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Liberar recurso', exact: true }),
  ).toHaveCount(0);
  expect(
    state.calls.filter((call) => call.path.includes('/budget')),
  ).toHaveLength(0);
});
