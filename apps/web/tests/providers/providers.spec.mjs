import { test, expect } from '@playwright/test';

const permissions = [
  'eventos.ver',
  'proveedores.ver',
  'proveedores.crear',
  'proveedores.editar',
  'proveedores.desactivar',
  'servicios_proveedor.ver',
  'servicios_proveedor.crear',
  'servicios_proveedor.editar',
  'servicios_proveedor.cancelar',
];
const provider = {
  id: 'p1',
  name: 'Hacienda El Jardín',
  categoryKeys: ['espacios', 'alimentacion'],
  contactName: 'Ana García',
  phone: '3001234567',
  email: 'ana@example.test',
  location: 'Pasto',
  notes: '',
  status: 'activo',
};
const service = {
  id: 's1',
  eventId: 'e1',
  providerId: 'p1',
  provider,
  serviceName: 'Cena principal',
  description: 'Cena para 80 invitados',
  startDate: '2026-12-05',
  startTime: '19:00',
  endDate: null,
  endTime: null,
  agreedAmountCop: 3200000,
  status: 'confirmado',
  cancelledAt: null,
};

async function setup(page, options = {}) {
  const state = {
    providers: [{ ...provider }],
    services: [{ ...service, provider: { ...provider } }],
    calls: [],
    errors: [],
    failSave: false,
    failList: false,
    holdSave: false,
    release: null,
    ...options,
  };
  page.on('pageerror', (error) => state.errors.push(error.message));
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
    const method = req.method();
    const path = url.pathname.replace('/api', '');
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
        body: JSON.stringify({ data, message: 'Operación exitosa' }),
      });
    const reject = (message) =>
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
    state.calls.push({
      method,
      path,
      query: Object.fromEntries(url.searchParams),
      body,
    });
    if (path === '/auth/me')
      return send({
        scope: 'tenant',
        user: { id: 'u1', name: 'Esthefany QA', email: 'qa@example.test' },
        profile: { name: 'Administrador' },
        tenant: { id: 't1', name: 'Empresa QA' },
        permissions: state.permissions || permissions,
      });
    if (path === '/events')
      return send({
        items: [
          {
            id: 'e1',
            name: 'Encuentro de diciembre',
            startAt: '2026-12-05T05:00:00.000Z',
            endAt: '2026-12-06T04:59:00.000Z',
            status: state.cancelledEvent ? 'cancelado' : 'planificado',
          },
        ],
        pagination: { totalPages: 1 },
      });
    if (method !== 'GET') {
      if (state.holdSave)
        await new Promise((resolve) => {
          state.release = resolve;
        });
      if (state.failSave)
        return reject('Error de prueba al guardar. Intenta de nuevo.');
    }
    if (path === '/providers' && method === 'GET') {
      if (state.failList)
        return reject('Error de prueba al cargar proveedores.');
      let items = state.providers.filter(
        (item) =>
          (!url.searchParams.get('status') ||
            item.status === url.searchParams.get('status')) &&
          (!url.searchParams.get('category') ||
            item.categoryKeys.includes(url.searchParams.get('category'))) &&
          (!url.searchParams.get('search') ||
            `${item.name} ${item.contactName}`
              .toLowerCase()
              .includes(url.searchParams.get('search').toLowerCase())),
      );
      const total = items.length;
      const limit = Number(url.searchParams.get('limit') || 10);
      const page = Number(url.searchParams.get('page') || 1);
      items = items.slice((page - 1) * limit, page * limit);
      return send({
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }
    if (path === '/providers' && method === 'POST') {
      const item = {
        ...provider,
        ...body,
        id: `p${state.providers.length + 1}`,
      };
      state.providers.push(item);
      return send(item);
    }
    if (path.startsWith('/providers/')) {
      const item = state.providers.find(
        (item) => item.id === path.split('/').pop(),
      );
      if (method === 'PATCH') Object.assign(item, body);
      if (method === 'DELETE') item.status = 'inactivo';
      return send(item);
    }
    if (path === '/events/e1/provider-services' && method === 'GET') {
      if (state.failServices)
        return reject('Error de prueba al cargar servicios.');
      return send(
        state.services.filter(
          (item) =>
            url.searchParams.get('includeCancelled') === 'true' ||
            item.status === 'confirmado',
        ),
      );
    }
    if (path === '/events/e1/provider-services' && method === 'POST') {
      const item = {
        ...service,
        ...body,
        id: `s${state.services.length + 1}`,
        provider: state.providers.find((item) => item.id === body.providerId),
      };
      state.services.push(item);
      return send(item);
    }
    if (path.startsWith('/events/e1/provider-services/')) {
      const item = state.services.find(
        (item) => item.id === path.split('/').pop(),
      );
      if (method === 'PATCH') Object.assign(item, body);
      if (method === 'DELETE')
        Object.assign(item, {
          status: 'cancelado',
          cancelledAt: '2026-11-03T12:00:00Z',
        });
      return send(item);
    }
    if (path === '/events/e1/resources') return send([]);
    if (path === '/inventory')
      return send({ items: [], pagination: { totalPages: 1 } });
    return reject(`Ruta inesperada: ${method} ${path}`);
  });
  return state;
}
async function assignments(page) {
  await page.goto('/recursos/asignaciones');
  await page.getByLabel('Evento', { exact: true }).selectOption('e1');
  await expect(page.getByText('Cena principal', { exact: true })).toBeVisible();
}
async function newService(page, name = 'Montaje del salón') {
  await page
    .getByRole('button', { name: 'Asignar servicio de proveedor' })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Proveedor', { exact: true }).selectOption('p1');
  await dialog.getByLabel('Nombre del servicio').fill(name);
  await dialog
    .getByLabel('Fecha acordada de prestación', { exact: true })
    .fill('2026-12-04');
  await dialog.getByLabel('Valor total acordado (COP)').fill('500000');
  return dialog;
}
function writes(state) {
  return state.calls.filter((call) => call.method !== 'GET');
}
async function fits(page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize().width + 1);
}

test('directorio: creación validada, búsqueda, categorías y edición', async ({
  page,
}, info) => {
  const state = await setup(page);
  await page.goto('/proveedores');
  await expect(
    page.getByRole('table').getByText('Hacienda El Jardín'),
  ).toBeVisible();
  await fits(page);
  await page.screenshot({
    path: info.outputPath('proveedores.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Crear proveedor' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Guardar proveedor' }).click();
  await expect(
    dialog.getByText('Selecciona al menos una categoría.'),
  ).toBeVisible();
  expect(writes(state)).toHaveLength(0);
  await dialog.getByLabel('Nombre', { exact: true }).fill('Transporte Andino');
  await dialog.getByLabel('Transporte', { exact: true }).check();
  await dialog.getByLabel('Otros', { exact: true }).check();
  await dialog.getByLabel('Teléfono').fill('3007654321');
  state.failSave = true;
  await dialog.getByRole('button', { name: 'Guardar proveedor' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Error de prueba');
  await expect(dialog.getByLabel('Nombre', { exact: true })).toHaveValue(
    'Transporte Andino',
  );
  state.failSave = false;
  await dialog.getByRole('button', { name: 'Guardar proveedor' }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByLabel('Categoría', { exact: true })
    .selectOption('transporte');
  await expect(
    page.getByRole('table').getByText('Transporte Andino'),
  ).toBeVisible();
  await expect(
    page.getByText('Hacienda El Jardín', { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel('Categoría', { exact: true }).selectOption('otros');
  await expect(
    page.getByRole('table').getByText('Transporte Andino'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Persona de contacto')
    .fill('Luis Pérez');
  await page.getByRole('button', { name: 'Guardar proveedor' }).click();
  await expect(page.getByRole('table').getByText('Luis Pérez')).toBeVisible();
  await page.getByLabel('Buscar por nombre o contacto').fill('Luis');
  await expect(
    page.getByRole('table').getByText('Transporte Andino'),
  ).toBeVisible();
  expect(state.errors).toEqual([]);
});

test('directorio: paginación, vacíos, error recuperable y desactivación confirmada', async ({
  page,
}) => {
  const state = await setup(page, {
    providers: Array.from({ length: 11 }, (_, i) => ({
      ...provider,
      id: `p${i}`,
      name: `Proveedor ${i}`,
    })),
    failList: true,
  });
  await page.goto('/proveedores');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Error de prueba' }),
  ).toContainText('Error de prueba');
  state.failList = false;
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByText('Proveedor 0', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByText('Proveedor 10', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Desactivar', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Volver' })
    .click();
  expect(writes(state)).toHaveLength(0);
  await page.getByRole('button', { name: 'Desactivar', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmar' })
    .click();
  await expect(
    page.getByRole('table').getByText('Inactivo', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Buscar por nombre o contacto').fill('inexistente');
  await expect(
    page.getByText('No hay proveedores que coincidan con estos filtros.'),
  ).toBeVisible();
});

test('servicios: varios acuerdos del mismo proveedor, fechas sin UTC y refresco independiente', async ({
  page,
}, info) => {
  const state = await setup(page, {
    permissions: [...permissions, 'asignaciones.ver', 'inventario.ver'],
  });
  await assignments(page);
  await fits(page);
  await expect(
    page.getByRole('region', { name: 'Reservas de inventario' }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath('servicios-proveedores.png'),
    fullPage: true,
  });
  const inventoryReads = state.calls.filter((call) =>
    call.path.endsWith('/resources'),
  ).length;
  const eventReads = state.calls.filter(
    (call) => call.path === '/events',
  ).length;
  const dialog = await newService(page);
  await expect(dialog.getByText(/La fecha acordada está fuera/)).toBeVisible();
  await fits(page);
  await page.screenshot({
    path: info.outputPath('asignar-servicio.png'),
    fullPage: true,
  });
  state.failSave = true;
  await dialog.getByRole('button', { name: 'Guardar servicio' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Error de prueba');
  await expect(dialog.getByLabel('Nombre del servicio')).toHaveValue(
    'Montaje del salón',
  );
  state.failSave = false;
  await dialog.getByRole('button', { name: 'Guardar servicio' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByText('Montaje del salón', { exact: true }),
  ).toBeVisible();
  expect(state.services).toHaveLength(2);
  expect(state.services[1].providerId).toBe('p1');
  const post = writes(state).at(-1);
  expect(post.body.startDate).toBe('2026-12-04');
  expect(post.body.agreedAmountCop).toBe(500000);
  expect(post.body.startTime).toBeNull();
  expect(
    state.calls.filter((call) => call.path.endsWith('/resources')),
  ).toHaveLength(inventoryReads);
  expect(state.calls.filter((call) => call.path === '/events')).toHaveLength(
    eventReads,
  );
  expect(
    writes(state).every((call) => call.path.includes('/provider-services')),
  ).toBe(true);
  expect(state.errors).toEqual([]);
});

test('servicios: validación de monto y fin, edición y cancelación con historial', async ({
  page,
}) => {
  const state = await setup(page);
  await assignments(page);
  await page
    .getByRole('button', { name: 'Editar servicio', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Valor total acordado (COP)').fill('0.5');
  await dialog.getByLabel('Hora de fin (opcional)').fill('18:00');
  await dialog.getByRole('button', { name: 'Guardar servicio' }).click();
  await expect(
    dialog.getByText('Ingresa un entero positivo en COP.'),
  ).toBeVisible();
  await expect(
    dialog.getByText('Indica una fecha de fin para la hora de fin.'),
  ).toBeVisible();
  expect(writes(state)).toHaveLength(0);
  await dialog.getByLabel('Fecha de fin (opcional)').fill('2026-12-04');
  await dialog.getByRole('button', { name: 'Guardar servicio' }).click();
  await expect(
    dialog.getByText('El fin no puede ser anterior al inicio.'),
  ).toBeVisible();
  await dialog.getByLabel('Fecha de fin (opcional)').fill('2026-12-05');
  await dialog.getByRole('button', { name: 'Guardar servicio' }).click();
  await expect(
    dialog.getByText('El fin no puede ser anterior al inicio.'),
  ).toBeVisible();
  await dialog.getByLabel('Hora de fin (opcional)').fill('');
  await dialog.getByLabel('Fecha de fin (opcional)').fill('');
  await dialog.getByLabel('Hora de inicio (opcional)').fill('');
  await dialog.getByLabel('Nombre del servicio').fill('Cena y atención');
  await dialog.getByLabel('Valor total acordado (COP)').fill('3300000');
  await dialog.getByRole('button', { name: 'Guardar servicio' }).click();
  await expect(
    page.getByText('Cena y atención', { exact: true }),
  ).toBeVisible();
  expect(writes(state)[0].body.startTime).toBeNull();
  await page
    .getByRole('button', { name: 'Cancelar servicio', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Volver' })
    .click();
  expect(state.services[0].status).toBe('confirmado');
  await page
    .getByRole('button', { name: 'Cancelar servicio', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmar' })
    .click();
  await expect(
    page.getByText(
      'No hay servicios de proveedores confirmados para este evento.',
    ),
  ).toBeVisible();
  await page.getByLabel('Incluir historial de cancelados').check();
  await expect(
    page.getByRole('table').getByText('Cancelado', { exact: true }),
  ).toBeVisible();
  expect(state.services).toHaveLength(1);
  await expect(
    page.getByRole('button', { name: 'Editar servicio' }),
  ).toHaveCount(0);
});

test('proveedor inactivo: conserva historial y edición, no aparece para nuevos acuerdos', async ({
  page,
}) => {
  const state = await setup(page, {
    providers: [{ ...provider, status: 'inactivo' }],
    services: [{ ...service, provider: { ...provider, status: 'inactivo' } }],
  });
  await assignments(page);
  await expect(page.getByText('Proveedor inactivo · Histórico')).toBeVisible();
  await page
    .getByRole('button', { name: 'Editar servicio', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Proveedor', { exact: true })).toHaveValue(
    'p1',
  );
  await dialog.getByLabel('Nombre del servicio').fill('Cena histórica');
  await dialog.getByRole('button', { name: 'Guardar servicio' }).click();
  await expect(page.getByText('Cena histórica', { exact: true })).toBeVisible();
  expect(writes(state)[0].body).not.toHaveProperty('providerId');
  await page
    .getByRole('button', { name: 'Asignar servicio de proveedor' })
    .click();
  await expect(
    page.getByText('No hay proveedores activos que coincidan con los filtros.'),
  ).toBeVisible();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('option', { name: 'Hacienda El Jardín', exact: true }),
  ).toHaveCount(0);
  expect(
    state.calls
      .filter((call) => call.path === '/providers')
      .every((call) => call.query.status === 'activo'),
  ).toBe(true);
});

test('evento cancelado: consulta y cancelación disponibles, creación y edición bloqueadas', async ({
  page,
}) => {
  await setup(page, { cancelledEvent: true });
  await assignments(page);
  await expect(
    page.getByRole('button', { name: 'Asignar servicio de proveedor' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Editar servicio' }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Cancelar servicio', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmar' })
    .click();
  await expect(
    page.getByText(
      'No hay servicios de proveedores confirmados para este evento.',
    ),
  ).toBeVisible();
});

test('permisos: servicios sin inventario; edición sin permiso para consultar proveedores', async ({
  page,
}) => {
  const state = await setup(page, {
    permissions: [
      'eventos.ver',
      'servicios_proveedor.ver',
      'servicios_proveedor.crear',
      'servicios_proveedor.editar',
    ],
  });
  await assignments(page);
  await expect(
    page
      .getByRole('navigation')
      .getByRole('link', { name: 'Recursos', exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('navigation')
      .getByRole('link', { name: 'Proveedores', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Reservas de inventario' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Asignar servicio de proveedor' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Cancelar servicio', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Editar servicio', exact: true })
    .click();
  await expect(
    page.getByText(/Sin permiso para cambiar el contacto/),
  ).toBeVisible();
  await page.getByLabel('Nombre del servicio').fill('Cambio autorizado');
  await page.getByRole('button', { name: 'Guardar servicio' }).click();
  await expect(
    page.getByText('Cambio autorizado', { exact: true }),
  ).toBeVisible();
  expect(
    state.calls.some(
      (call) =>
        call.path === '/providers' ||
        call.path === '/inventory' ||
        call.path.endsWith('/resources'),
    ),
  ).toBe(false);
});

test('permisos: directorio solo lectura y ruta protegida', async ({ page }) => {
  await setup(page, { permissions: ['proveedores.ver'] });
  await page.goto('/proveedores');
  await expect(page.getByRole('table')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Crear proveedor|Editar|Desactivar/ }),
  ).toHaveCount(0);
  await page.goto('/recursos/asignaciones');
  await expect(page).toHaveURL('/proveedores');
});

test('sin eventos.ver no consulta eventos ni carga servicios; creación exige proveedores.ver', async ({
  page,
}) => {
  const state = await setup(page, {
    permissions: ['servicios_proveedor.ver', 'servicios_proveedor.crear'],
  });
  await page.goto('/recursos/asignaciones');
  await expect(
    page.getByText(/Necesitas el permiso de consulta de eventos/),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Asignar servicio de proveedor' }),
  ).toHaveCount(0);
  expect(state.calls.some((call) => call.path.startsWith('/events'))).toBe(
    false,
  );
});

test('inventario sin servicios no consulta acuerdos', async ({ page }) => {
  const state = await setup(page, {
    permissions: ['eventos.ver', 'asignaciones.ver'],
  });
  await page.goto('/recursos/asignaciones');
  await page.getByLabel('Evento', { exact: true }).selectOption('e1');
  await expect(
    page.getByRole('region', { name: 'Reservas de inventario' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Servicios de proveedores' }),
  ).toHaveCount(0);
  expect(
    state.calls.some((call) => call.path.includes('provider-services')),
  ).toBe(false);
});

test('servicios: carga fallida se recupera y guardado en curso bloquea cierre', async ({
  page,
}) => {
  const state = await setup(page, { failServices: true });
  await page.goto('/recursos/asignaciones');
  await page.getByLabel('Evento', { exact: true }).selectOption('e1');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Error de prueba' }),
  ).toContainText('Error de prueba');
  state.failServices = false;
  await page.getByRole('button', { name: 'Reintentar servicios' }).click();
  await expect(page.getByText('Cena principal', { exact: true })).toBeVisible();
  const dialog = await newService(page);
  state.holdSave = true;
  await dialog.getByRole('button', { name: 'Guardar servicio' }).click();
  await expect(
    dialog.getByRole('button', { name: 'Cerrar ventana' }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect.poll(() => !!state.release).toBe(true);
  state.release();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.errors).toEqual([]);
});

test('sin sesión el directorio redirige al login', async ({ page }) => {
  await page.goto('/proveedores');
  await expect(page).toHaveURL('/login');
});
