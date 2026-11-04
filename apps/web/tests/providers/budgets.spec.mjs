import { test, expect } from '@playwright/test';

const basePermissions = [
  'eventos.ver',
  'presupuestos.ver',
  'presupuestos.editar',
  'proveedores.ver',
  'proveedores.crear',
  'proveedores.editar',
  'proveedores.desactivar',
  'servicios_proveedor.ver',
  'servicios_proveedor.crear',
  'servicios_proveedor.editar',
  'servicios_proveedor.cancelar',
];
const event = {
  id: 'e1',
  name: 'Evento financiero',
  baseBudget: 10000,
  status: 'planificado',
  startAt: '2026-12-05T05:00:00Z',
  endAt: '2026-12-06T04:59:00Z',
  responsibleUserId: 'leader',
};
const provider = {
  id: 'p1',
  name: 'Proveedor financiero',
  categoryKeys: ['alimentacion'],
  contactName: 'Ana',
  phone: '3001234567',
  email: null,
  location: 'Pasto',
  status: 'activo',
};
async function setup(page, options = {}) {
  const state = {
    actor: 'requester',
    initialized: true,
    base: 10000,
    increase: 0,
    inventory: 100,
    extra: 0,
    services: [],
    requests: [],
    providers: [{ ...provider }],
    calls: [],
    fail: null,
    ...options,
  };
  const amounts = () => {
    const providerSpentCop = state.services
      .filter((item) => item.status === 'confirmado')
      .reduce((sum, item) => sum + item.agreedAmountCop, 0);
    const allocatedCop = state.base + state.increase;
    const spentCop = state.inventory + providerSpentCop + state.extra;
    return {
      baseAmountCop: state.initialized ? state.base : null,
      approvedIncreaseCop: state.increase,
      inventorySpentCop: state.inventory,
      providerSpentCop,
      extraSpentCop: state.extra,
      allocatedCop,
      spentCop,
      remainingCop: allocatedCop - spentCop,
    };
  };
  state.amounts = amounts;
  await page.context().addCookies([
    {
      name: 'evoria_access_token',
      value: 'test-only',
      url: 'http://localhost:3100',
    },
  ]);
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace('/api', '');
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
    const reject = (message, status = 409) =>
      route.fulfill({
        status,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({ message }),
      });
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const body = ['POST', 'PATCH'].includes(method)
      ? req.postDataJSON()
      : undefined;
    state.calls.push({
      path,
      method,
      query: Object.fromEntries(url.searchParams),
      body,
    });
    if (path === '/auth/me')
      return send({
        scope: 'tenant',
        user: { id: state.actor, name: state.actor, email: 'qa@example.test' },
        profile: { name: 'QA' },
        tenant: { id: 't1', name: 'Empresa financiera' },
        permissions: options.permissions ?? [
          ...basePermissions,
          ...(state.actor === 'leader' ? ['presupuestos.aprobar'] : []),
        ],
      });
    if (state.fail && state.fail.path === path && state.fail.method === method)
      return reject(state.fail.message, state.fail.status);
    const summary = {
      eventId: 'e1',
      eventName: event.name,
      eventStatus: state.cancelled ? 'cancelado' : 'planificado',
      initialized: state.initialized,
      ...amounts(),
    };
    if (path === '/budgets') {
      const pageNumber = Number(url.searchParams.get('page') || 1);
      return send({
        totals: {
          allocatedCop: summary.allocatedCop,
          spentCop: summary.spentCop,
          remainingCop: summary.remainingCop,
        },
        items: [summary],
        pagination: { page: pageNumber, limit: 10, total: 11, totalPages: 2 },
      });
    }
    if (path === '/budgets/authorizations')
      return send(
        state.requests
          .filter(
            (item) =>
              item.status === 'pendiente' &&
              item.requestedBy !== state.actor &&
              state.actor === 'leader',
          )
          .map((item) => ({ ...item, eventName: event.name })),
      );
    if (path === '/events')
      return send({
        items: [{ ...event, status: summary.eventStatus }],
        pagination: { page: 1, totalPages: 1 },
      });
    if (path === '/events/e1')
      return send({
        ...event,
        baseBudget: state.base,
        status: summary.eventStatus,
      });
    if (path === '/events/e1/budget' && method === 'GET')
      return send({
        ...summary,
        inventoryLines: [],
        providerLines: state.services.map((item) => ({
          id: item.id,
          providerId: item.providerId,
          providerName: item.provider.name,
          serviceName: item.serviceName,
          agreedAmountCop: item.agreedAmountCop,
          status: item.status,
          startDate: item.startDate,
        })),
        requests: state.requests,
      });
    if (path === '/events/e1/budget' && method === 'POST') {
      state.initialized = true;
      state.base = body.baseAmountCop;
      return send(summary);
    }
    if (path === '/events/e1/budget/requests') {
      const item = {
        ...body,
        id: `r${state.requests.length + 1}`,
        eventId: 'e1',
        status: 'pendiente',
        requestedBy: state.actor,
        requestedAt: '2026-11-04T15:00:00Z',
        decidedBy: null,
        decidedAt: null,
        rejectionReason: null,
      };
      state.requests.push(item);
      return send(item);
    }
    if (path.match(/\/budget\/requests\/r\d+\/(approve|reject)$/)) {
      const item = state.requests.find((item) => path.includes(`/${item.id}/`));
      if (item.status !== 'pendiente')
        return reject('La solicitud ya fue decidida.');
      if (path.endsWith('/approve')) {
        item.status = 'aprobada';
        if (item.type === 'ampliacion') state.increase += item.amountCop;
        else state.extra += item.amountCop;
      } else {
        item.status = 'rechazada';
        item.rejectionReason = body.reason;
      }
      item.decidedBy = state.actor;
      item.decidedAt = '2026-11-04T16:00:00Z';
      return send(item);
    }
    if (path === '/providers' && method === 'GET')
      return send({
        items: state.providers.filter(
          (item) =>
            !url.searchParams.get('status') ||
            item.status === url.searchParams.get('status'),
        ),
        pagination: { page: 1, total: state.providers.length, totalPages: 1 },
      });
    if (path === '/events/e1/provider-services' && method === 'GET')
      return send(state.services);
    if (path === '/events/e1/provider-services' && method === 'POST') {
      const item = {
        ...body,
        id: `s${state.services.length + 1}`,
        eventId: 'e1',
        provider: state.providers.find((item) => item.id === body.providerId),
        status: 'confirmado',
      };
      state.services.push(item);
      return send(item);
    }
    if (
      path.startsWith('/events/e1/provider-services/') &&
      method === 'DELETE'
    ) {
      const item = state.services.find((item) => path.endsWith(`/${item.id}`));
      item.status = 'cancelado';
      return send(item);
    }
    return reject(`Ruta inesperada: ${method} ${path}`, 404);
  });
  return state;
}
async function openBudget(page) {
  await page.goto('/presupuestos?eventId=e1');
  await expect(
    page.getByRole('heading', { name: 'Presupuesto del evento', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Solicitar cambio de presupuesto' }),
  ).toBeVisible();
}
async function requestChange(page, type = 'ampliacion') {
  await page
    .getByRole('button', { name: 'Solicitar cambio de presupuesto' })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tipo de solicitud').selectOption(type);
  await dialog.getByLabel('Monto solicitado (COP)').fill('2000');
  await dialog
    .getByLabel('Motivo', { exact: true })
    .fill('Se requieren recursos adicionales');
  await dialog.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(dialog).toHaveCount(0);
}
function available(page) {
  return page
    .locator('dl')
    .filter({ has: page.getByText('Disponible', { exact: true }) })
    .locator('div')
    .filter({ has: page.locator('dt', { hasText: /^Disponible$/ }) })
    .locator('dd');
}

test('presupuestos: búsqueda y paginación envían filtros al servidor', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/presupuestos');
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByLabel('Buscar evento').fill('financiero');
  await expect
    .poll(
      () =>
        state.calls.filter((call) => call.path === '/budgets').at(-1)?.query
          .search,
    )
    .toBe('financiero');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect
    .poll(
      () =>
        state.calls.filter((call) => call.path === '/budgets').at(-1)?.query
          .page,
    )
    .toBe('2');
});

test('solicitud pendiente no altera saldo; líder confirma aprobación y refresca bandeja, detalle y totales', async ({
  page,
}) => {
  const state = await setup(page);
  await openBudget(page);
  await expect(available(page)).toContainText('9.900');
  await requestChange(page);
  await expect(available(page)).toContainText('9.900');
  await expect(
    page.getByText('Pendiente · sin efecto en el saldo', { exact: true }),
  ).toBeVisible();
  expect(state.amounts().remainingCop).toBe(9900);
  state.actor = 'leader';
  await page.reload();
  await page.getByRole('button', { name: /Autorizaciones pendientes/ }).click();
  await page
    .getByRole('button', { name: 'Revisar presupuesto y decidir' })
    .click();
  await page.getByRole('button', { name: 'Aprobar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('9.900', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirmar aprobación' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(available(page)).toContainText('11.900');
  await expect(
    page.getByText('No tienes autorizaciones pendientes.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Resumen por evento' }).click();
  await expect(page.getByRole('table').first()).toContainText('12.000');
  await page.screenshot({
    path: test.info().outputPath('presupuesto-aprobado.png'),
    fullPage: true,
  });
});

test('rechazo exige motivo; conflicto conserva texto y permite reintentar', async ({
  page,
}) => {
  const state = await setup(page);
  await openBudget(page);
  await requestChange(page, 'costo_adicional');
  state.actor = 'leader';
  await page.reload();
  await page.getByRole('button', { name: 'Rechazar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Confirmar rechazo' }).click();
  await expect(
    dialog.getByText('Escribe un motivo de al menos diez caracteres.'),
  ).toBeVisible();
  await dialog
    .getByLabel('Motivo de rechazo')
    .fill('El gasto no es necesario ahora');
  state.fail = {
    path: '/events/e1/budget/requests/r1/reject',
    method: 'POST',
    message: 'La solicitud ya fue decidida.',
    status: 409,
  };
  await dialog.getByRole('button', { name: 'Confirmar rechazo' }).click();
  await expect(dialog.getByRole('alert')).toContainText('ya fue decidida');
  await expect(dialog.getByLabel('Motivo de rechazo')).toHaveValue(
    'El gasto no es necesario ahora',
  );
  state.fail = null;
  await dialog.getByRole('button', { name: 'Confirmar rechazo' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText('Motivo de rechazo: El gasto no es necesario ahora'),
  ).toBeVisible();
  await expect(available(page)).toContainText('9.900');
});

test('presupuesto sin iniciar: bloquea asignaciones, inicia y habilita servicio con efecto financiero y cancelación histórica', async ({
  page,
}) => {
  const state = await setup(page, { initialized: false });
  await page.goto('/recursos/asignaciones');
  await page.getByLabel('Evento', { exact: true }).selectOption('e1');
  await expect(
    page.getByRole('button', { name: 'Asignar servicio de proveedor' }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Iniciar presupuesto', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByLabel('Presupuesto base (COP)')
    .fill('10000');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Iniciar presupuesto', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Asignar servicio de proveedor' })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Proveedor', { exact: true }).selectOption('p1');
  await dialog.getByLabel('Nombre del servicio').fill('Preparación y montaje');
  await dialog.getByLabel('Fecha acordada de prestación').fill('2026-12-04');
  await dialog.getByLabel('Valor total acordado (COP)').fill('500');
  await expect(dialog.getByText(/fuera del intervalo/)).toBeVisible();
  state.fail = {
    path: '/events/e1/provider-services',
    method: 'POST',
    message: 'El costo supera el presupuesto disponible del evento.',
    status: 409,
  };
  await dialog.getByRole('button', { name: 'Guardar servicio' }).click();
  await expect(dialog.getByRole('alert')).toContainText(
    'presupuesto disponible',
  );
  await expect(dialog.getByLabel('Nombre del servicio')).toHaveValue(
    'Preparación y montaje',
  );
  await expect(dialog.getByLabel('Valor total acordado (COP)')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  state.fail = null;
  await dialog.getByRole('button', { name: 'Guardar servicio' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(available(page)).toContainText('9.400');
  await page.screenshot({
    path: test.info().outputPath('servicio-y-presupuesto.png'),
    fullPage: true,
  });
  await expect(
    page
      .getByRole('region', { name: 'Servicios de proveedores', exact: true })
      .getByRole('table'),
  ).toContainText('Preparación y montaje');
  await page
    .getByRole('button', { name: 'Cancelar servicio', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmar' })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(available(page)).toContainText('9.900');
  await expect(
    page
      .getByRole('region', { name: 'Servicios de proveedores', exact: true })
      .getByRole('table'),
  ).toContainText('Cancelado');
  expect(
    state.calls.some(
      (call) => call.path === '/providers' && call.query.status === 'activo',
    ),
  ).toBe(true);
});

test('solo lectura: sin operaciones de presupuesto; errores 403 y 404 claros y recuperables', async ({
  page,
}) => {
  const state = await setup(page, { permissions: ['presupuestos.ver'] });
  await page.goto('/presupuestos?eventId=e1');
  await expect(
    page.getByRole('heading', { name: 'Presupuesto del evento', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: /Solicitar cambio|Aprobar|Rechazar|Iniciar presupuesto/,
    }),
  ).toHaveCount(0);
  state.fail = {
    path: '/events/e1/budget',
    method: 'GET',
    message: 'El presupuesto no existe.',
    status: 404,
  };
  await page.getByRole('button', { name: 'Actualizar presupuesto' }).click();
  await expect(
    page
      .getByRole('region', { name: 'Detalle del presupuesto' })
      .getByRole('alert'),
  ).toContainText('no existe');
  state.fail = { ...state.fail, message: 'Acceso denegado.', status: 403 };
  await page.getByRole('button', { name: 'Actualizar presupuesto' }).click();
  await expect(
    page
      .getByRole('region', { name: 'Detalle del presupuesto' })
      .getByRole('alert'),
  ).toContainText('No tienes permiso');
  state.fail = null;
  await page.getByRole('button', { name: 'Actualizar presupuesto' }).click();
  await expect(
    page
      .getByRole('region', { name: 'Detalle del presupuesto' })
      .getByRole('alert'),
  ).toHaveCount(0);
});

test('evento cancelado: conserva detalle sin solicitudes ni decisiones nuevas', async ({
  page,
}) => {
  await setup(page, { cancelled: true });
  await page.goto('/presupuestos?eventId=e1');
  await expect(
    page.getByText(/Evento cancelado: se conserva el historial/),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Solicitar cambio de presupuesto' }),
  ).toHaveCount(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test('solicitud valida COP y motivo, conserva formulario ante 403 y oculta autoaprobación', async ({
  page,
}) => {
  const state = await setup(page, {
    permissions: [...basePermissions, 'presupuestos.aprobar'],
  });
  await openBudget(page);
  await page
    .getByRole('button', { name: 'Solicitar cambio de presupuesto' })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Monto solicitado (COP)').fill('2.5');
  await dialog.getByLabel('Motivo', { exact: true }).fill('corto');
  await dialog.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(
    dialog.getByText('Ingresa un entero positivo en COP.'),
  ).toBeVisible();
  await expect(
    dialog.getByText('Escribe un motivo de al menos diez caracteres.'),
  ).toBeVisible();
  expect(
    state.calls.filter(
      (call) => call.path.endsWith('/requests') && call.method === 'POST',
    ),
  ).toHaveLength(0);
  await dialog.getByLabel('Monto solicitado (COP)').fill('2000');
  await dialog
    .getByLabel('Motivo', { exact: true })
    .fill('Material adicional para la preparación');
  state.fail = {
    path: '/events/e1/budget/requests',
    method: 'POST',
    status: 403,
    message: 'Solo el líder asignado puede decidir.',
  };
  await dialog.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(dialog.getByRole('alert')).toContainText('No tienes permiso');
  await expect(dialog.getByLabel('Monto solicitado (COP)')).toHaveValue('2000');
  await expect(dialog.getByLabel('Motivo', { exact: true })).toHaveValue(
    'Material adicional para la preparación',
  );
  state.fail = null;
  await dialog.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText('Pendiente · sin efecto en el saldo', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Aprobar', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Rechazar', exact: true }),
  ).toHaveCount(0);
});

test('aprobar costo adicional aplica el gasto y saldo que devuelve la API', async ({
  page,
}) => {
  const state = await setup(page);
  await openBudget(page);
  await requestChange(page, 'costo_adicional');
  state.actor = 'leader';
  await page.reload();
  await page.getByRole('button', { name: 'Aprobar', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByText(/aumentará el gasto adicional/),
  ).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmar aprobación' })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(available(page)).toContainText('7.900');
  await expect(
    page
      .locator('dl div')
      .filter({
        has: page.locator('dt', { hasText: /^Costos adicionales aprobados$/ }),
      })
      .locator('dd'),
  ).toContainText('2.000');
});
