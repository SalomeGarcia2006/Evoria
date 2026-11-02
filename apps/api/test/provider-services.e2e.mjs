import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const baseUrl = process.env.API_BASE_URL;
const developerEmail = process.env.E2E_DEV_EMAIL;
const developerPassword = process.env.E2E_DEV_PASSWORD;

if (!baseUrl || !developerEmail || !developerPassword) {
  throw new Error('Define API_BASE_URL, E2E_DEV_EMAIL y E2E_DEV_PASSWORD.');
}

const runId = randomUUID().slice(0, 8);
const ownerPassword = `LocalTest-${randomUUID()}!`;
let checks = 0;

async function request(method, path, body, cookie) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
    cookie: response.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; '),
  };
}

function expectStatus(result, status, label) {
  assert.equal(
    result.status,
    status,
    `${label}: ${JSON.stringify(result.body)}`,
  );
  checks++;
  process.stdout.write(`OK ${status} ${label}\n`);
  return result.body?.data;
}

async function login(email, password) {
  const result = await request('POST', '/auth/login', { email, password });
  expectStatus(result, 200, `login ${email}`);
  assert.ok(
    result.cookie.includes('evoria_access_token='),
    'El login debe establecer cookie de acceso',
  );
  return result.cookie;
}

const health = await request('GET', '/health');
expectStatus(health, 200, 'health');
expectStatus(await request('GET', '/providers'), 401, 'directorio sin sesión');

const developerCookie = await login(developerEmail, developerPassword);
expectStatus(
  await request('GET', '/providers', undefined, developerCookie),
  403,
  'sesión global sin empresa',
);

async function createTenant(suffix) {
  const email = `owner-${runId}-${suffix}@example.test`;
  const result = await request(
    'POST',
    '/tenants',
    {
      name: `Empresa prueba ${runId} ${suffix}`,
      nit: `${runId}-${suffix}`,
      ownerName: `Propietario ${suffix}`,
      ownerEmail: email,
      ownerPassword,
    },
    developerCookie,
  );
  const tenant = expectStatus(result, 201, `crear empresa ${suffix}`);
  return { tenant, cookie: await login(email, ownerPassword) };
}

const firstTenant = await createTenant('A');
const secondTenant = await createTenant('B');
const ownerCookie = firstTenant.cookie;

const provider = expectStatus(
  await request(
    'POST',
    '/providers',
    {
      name: 'Hacienda El Sol',
      categoryKeys: ['espacios', 'alimentacion'],
      contactName: 'Ana Prueba',
      phone: '3000000000',
      email: 'ana@example.test',
    },
    ownerCookie,
  ),
  201,
  'crear proveedor con dos categorías',
);

for (const category of ['espacios', 'alimentacion']) {
  const list = expectStatus(
    await request(
      'GET',
      `/providers?category=${category}&search=Ana&status=activo`,
      undefined,
      ownerCookie,
    ),
    200,
    `filtrar ${category}`,
  );
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].id, provider.id);
}

expectStatus(
  await request(
    'GET',
    `/providers/${provider.id}`,
    undefined,
    secondTenant.cookie,
  ),
  404,
  'otra empresa no ve proveedor',
);
expectStatus(
  await request(
    'POST',
    '/providers',
    { name: 'Sin contacto', categoryKeys: ['otros'] },
    ownerCookie,
  ),
  400,
  'contacto obligatorio',
);
expectStatus(
  await request(
    'POST',
    '/providers',
    { name: 'Categoría inválida', categoryKeys: ['invalida'], phone: '123' },
    ownerCookie,
  ),
  400,
  'categoría inválida',
);
expectStatus(
  await request(
    'POST',
    '/providers',
    {
      name: 'Categorías duplicadas',
      categoryKeys: ['otros', 'otros'],
      phone: '123',
    },
    ownerCookie,
  ),
  400,
  'categorías duplicadas',
);

const event = expectStatus(
  await request(
    'POST',
    '/events',
    {
      name: 'Evento de prueba',
      startAt: '2026-12-05T15:00:00.000Z',
      endAt: '2026-12-06T02:00:00.000Z',
    },
    ownerCookie,
  ),
  201,
  'crear evento',
);
const budgetPath = `/events/${event.id}/budget`;
expectStatus(
  await request('POST', budgetPath, { baseAmountCop: 9000000 }, ownerCookie),
  201,
  'iniciar presupuesto del evento',
);

const inventory = expectStatus(
  await request(
    'POST',
    '/inventory',
    {
      name: 'Silla de prueba',
      type: 'mobiliario',
      unitCost: 10000,
      totalQuantity: 10,
    },
    ownerCookie,
  ),
  201,
  'crear inventario de control',
);

const servicePath = `/events/${event.id}/provider-services`;
const firstService = expectStatus(
  await request(
    'POST',
    servicePath,
    {
      providerId: provider.id,
      serviceName: 'Cena principal',
      description: 'Cena para 80 personas',
      startDate: '2026-12-05',
      startTime: '19:00',
      endDate: '2026-12-05',
      endTime: '22:00',
      agreedAmountCop: 3200000,
    },
    ownerCookie,
  ),
  201,
  'asignar primer servicio',
);

const secondService = expectStatus(
  await request(
    'POST',
    servicePath,
    {
      providerId: provider.id,
      serviceName: 'Alquiler de hacienda',
      startDate: '2026-12-04',
      endDate: '2026-12-07',
      agreedAmountCop: 5000000,
    },
    ownerCookie,
  ),
  201,
  'asignar segundo servicio fuera del intervalo',
);
assert.notEqual(firstService.id, secondService.id);

const active = expectStatus(
  await request('GET', servicePath, undefined, ownerCookie),
  200,
  'listar dos acuerdos',
);
assert.equal(active.length, 2);

async function createLimitedUser(suffix, permissionKeys) {
  const profile = expectStatus(
    await request(
      'POST',
      '/profiles',
      {
        name: `Perfil ${runId} ${suffix}`,
        description: 'Perfil temporal de prueba de permisos',
        permissionKeys,
      },
      ownerCookie,
    ),
    201,
    `crear perfil ${suffix}`,
  );
  const email = `limited-${runId}-${suffix}@example.test`;
  expectStatus(
    await request(
      'POST',
      '/users',
      {
        name: `Usuario ${suffix}`,
        email,
        password: ownerPassword,
        profileId: profile.id,
      },
      ownerCookie,
    ),
    201,
    `crear usuario ${suffix}`,
  );
  return login(email, ownerPassword);
}

const viewerCookie = await createLimitedUser('viewer', [
  'proveedores.ver',
  'servicios_proveedor.ver',
]);
expectStatus(
  await request('GET', `/providers/${provider.id}`, undefined, viewerCookie),
  200,
  'permiso de consulta de proveedor',
);
expectStatus(
  await request('GET', servicePath, undefined, viewerCookie),
  200,
  'permiso de consulta de acuerdos',
);
expectStatus(
  await request(
    'POST',
    '/providers',
    { name: 'Sin permiso', categoryKeys: ['otros'], phone: '123' },
    viewerCookie,
  ),
  403,
  'lector no crea proveedor',
);
expectStatus(
  await request(
    'POST',
    servicePath,
    {
      providerId: provider.id,
      serviceName: 'Sin permiso',
      startDate: '2026-12-05',
      agreedAmountCop: 1000,
    },
    viewerCookie,
  ),
  403,
  'lector no crea acuerdo',
);

const noDirectoryCookie = await createLimitedUser('no-directory', [
  'servicios_proveedor.crear',
]);
expectStatus(
  await request(
    'POST',
    servicePath,
    {
      providerId: provider.id,
      serviceName: 'Sin consulta de directorio',
      startDate: '2026-12-05',
      agreedAmountCop: 1000,
    },
    noDirectoryCookie,
  ),
  403,
  'crear acuerdo exige proveedores.ver',
);

const leaderProfile = expectStatus(
  await request(
    'POST',
    '/profiles',
    {
      name: `Lider presupuesto ${runId}`,
      description: 'Autoriza cambios de presupuesto',
      permissionKeys: ['presupuestos.ver', 'presupuestos.aprobar'],
    },
    ownerCookie,
  ),
  201,
  'crear perfil de lider',
);
const leaderEmail = `leader-${runId}@example.test`;
const leader = expectStatus(
  await request(
    'POST',
    '/users',
    {
      name: 'Lider de presupuesto',
      email: leaderEmail,
      password: ownerPassword,
      profileId: leaderProfile.id,
    },
    ownerCookie,
  ),
  201,
  'crear lider del evento',
);
// Auth permite cinco inicios de sesión por minuto por IP.
await new Promise((resolve) => setTimeout(resolve, 61000));
const leaderCookie = await login(leaderEmail, ownerPassword);
expectStatus(
  await request(
    'PATCH',
    `/events/${event.id}`,
    { responsibleUserId: leader.id },
    ownerCookie,
  ),
  200,
  'asignar lider del evento',
);
const budgetBefore = expectStatus(
  await request('GET', budgetPath, undefined, ownerCookie),
  200,
  'presupuesto con servicios confirmados',
);
assert.equal(budgetBefore.providerSpentCop, 8200000);
assert.equal(budgetBefore.remainingCop, 800000);
const increaseRequest = expectStatus(
  await request(
    'POST',
    `${budgetPath}/requests`,
    {
      type: 'ampliacion',
      amountCop: 1000000,
      reason: 'El cliente amplio el alcance',
    },
    ownerCookie,
  ),
  201,
  'solicitar ampliacion justificada',
);
assert.equal(
  expectStatus(
    await request('GET', budgetPath, undefined, ownerCookie),
    200,
    'solicitud pendiente no cambia presupuesto',
  ).allocatedCop,
  9000000,
);
const pending = expectStatus(
  await request('GET', '/budgets/authorizations', undefined, leaderCookie),
  200,
  'lider ve autorizacion pendiente',
);
assert.ok(pending.some((item) => item.id === increaseRequest.id));
expectStatus(
  await request(
    'POST',
    `${budgetPath}/requests/${increaseRequest.id}/approve`,
    undefined,
    ownerCookie,
  ),
  403,
  'solicitante no puede aprobar',
);
expectStatus(
  await request(
    'POST',
    `${budgetPath}/requests/${increaseRequest.id}/approve`,
    undefined,
    leaderCookie,
  ),
  201,
  'lider aprueba ampliacion',
);
expectStatus(
  await request(
    'POST',
    `${budgetPath}/requests/${increaseRequest.id}/approve`,
    undefined,
    leaderCookie,
  ),
  409,
  'no se aprueba dos veces',
);
const extraRequest = expectStatus(
  await request(
    'POST',
    `${budgetPath}/requests`,
    {
      type: 'costo_adicional',
      amountCop: 500000,
      reason: 'Transporte adicional solicitado',
    },
    ownerCookie,
  ),
  201,
  'solicitar costo adicional',
);
expectStatus(
  await request(
    'POST',
    `${budgetPath}/requests/${extraRequest.id}/approve`,
    undefined,
    leaderCookie,
  ),
  201,
  'lider aprueba costo adicional',
);
const budgetAfter = expectStatus(
  await request('GET', budgetPath, undefined, ownerCookie),
  200,
  'presupuesto actualizado',
);
assert.equal(budgetAfter.allocatedCop, 10000000);
assert.equal(budgetAfter.extraSpentCop, 500000);
assert.equal(budgetAfter.remainingCop, 1300000);
const unaffordableRequest = expectStatus(
  await request(
    'POST',
    `${budgetPath}/requests`,
    {
      type: 'costo_adicional',
      amountCop: 2000000,
      reason: 'Gasto extraordinario mayor al saldo',
    },
    ownerCookie,
  ),
  201,
  'registrar solicitud mayor al saldo sin gastar',
);
expectStatus(
  await request(
    'POST',
    `${budgetPath}/requests/${unaffordableRequest.id}/approve`,
    undefined,
    leaderCookie,
  ),
  409,
  'bloquear aprobacion de costo sin saldo',
);
expectStatus(
  await request(
    'POST',
    `${budgetPath}/requests/${unaffordableRequest.id}/reject`,
    { reason: 'El saldo disponible es insuficiente' },
    leaderCookie,
  ),
  201,
  'lider rechaza solicitud con motivo',
);
assert.equal(
  expectStatus(
    await request('GET', budgetPath, undefined, ownerCookie),
    200,
    'rechazo no altera el gasto',
  ).extraSpentCop,
  500000,
);

const inventoryAfter = expectStatus(
  await request('GET', `/inventory/${inventory.id}`, undefined, ownerCookie),
  200,
  'consultar inventario sin cambios',
);
assert.equal(inventoryAfter.availableQuantity, 10);
assert.equal(inventoryAfter.reservedQuantity, 0);
const resourcePath = `/events/${event.id}/resources`;
expectStatus(
  await request(
    'POST',
    resourcePath,
    { inventoryItemId: inventory.id, quantity: 3 },
    ownerCookie,
  ),
  201,
  'asignar inventario con costo reservado',
);
expectStatus(
  await request(
    'DELETE',
    `${resourcePath}/${inventory.id}`,
    undefined,
    ownerCookie,
  ),
  200,
  'devolver inventario conserva gasto historico',
);
assert.equal(
  expectStatus(
    await request('GET', budgetPath, undefined, ownerCookie),
    200,
    'consultar gasto historico de inventario',
  ).inventorySpentCop,
  30000,
);
expectStatus(
  await request(
    'POST',
    servicePath,
    {
      providerId: provider.id,
      serviceName: 'Servicio fuera de presupuesto',
      startDate: '2026-12-05',
      agreedAmountCop: 2000000,
    },
    ownerCookie,
  ),
  409,
  'bloquear servicio que supera el saldo',
);

const corrected = expectStatus(
  await request(
    'PATCH',
    `${servicePath}/${firstService.id}`,
    {
      description: 'Cena corregida para 80 personas',
      agreedAmountCop: 3300000,
    },
    ownerCookie,
  ),
  200,
  'corregir acuerdo',
);
assert.equal(corrected.agreedAmountCop, 3300000);

for (const [label, body] of [
  ['fecha inexistente', { startDate: '2026-02-30' }],
  ['fin anterior', { startDate: '2026-12-05', endDate: '2026-12-04' }],
  ['hora final sin fecha', { endTime: '22:00' }],
  ['monto no positivo', { agreedAmountCop: 0 }],
]) {
  expectStatus(
    await request(
      'POST',
      servicePath,
      {
        providerId: provider.id,
        serviceName: 'Intento inválido',
        startDate: '2026-12-05',
        agreedAmountCop: 1000,
        ...body,
      },
      ownerCookie,
    ),
    400,
    label,
  );
}

expectStatus(
  await request(
    'PATCH',
    `/providers/${provider.id}`,
    { contactName: 'Nuevo contacto' },
    ownerCookie,
  ),
  200,
  'editar contacto',
);
const afterContactEdit = expectStatus(
  await request('GET', servicePath, undefined, ownerCookie),
  200,
  'acuerdo conservado tras editar contacto',
);
assert.equal(
  afterContactEdit.find((item) => item.id === firstService.id).description,
  'Cena corregida para 80 personas',
);
assert.equal(
  afterContactEdit.find((item) => item.id === firstService.id).agreedAmountCop,
  3300000,
);

expectStatus(
  await request('DELETE', `/providers/${provider.id}`, undefined, ownerCookie),
  200,
  'desactivar proveedor',
);
expectStatus(
  await request(
    'POST',
    servicePath,
    {
      providerId: provider.id,
      serviceName: 'Nuevo servicio',
      startDate: '2026-12-05',
      agreedAmountCop: 1000,
    },
    ownerCookie,
  ),
  409,
  'proveedor inactivo no acepta nuevos acuerdos',
);
const afterDeactivate = expectStatus(
  await request('GET', servicePath, undefined, ownerCookie),
  200,
  'historial conserva proveedor inactivo',
);
assert.equal(afterDeactivate.length, 2);
assert.ok(afterDeactivate.every((item) => item.provider.status === 'inactivo'));

const cancelled = expectStatus(
  await request(
    'DELETE',
    `${servicePath}/${firstService.id}`,
    undefined,
    ownerCookie,
  ),
  200,
  'cancelar acuerdo',
);
assert.equal(cancelled.status, 'cancelado');
assert.ok(cancelled.cancelledAt);
const remaining = expectStatus(
  await request('GET', servicePath, undefined, ownerCookie),
  200,
  'listado activo excluye cancelado',
);
assert.equal(remaining.length, 1);
const history = expectStatus(
  await request(
    'GET',
    `${servicePath}?includeCancelled=true`,
    undefined,
    ownerCookie,
  ),
  200,
  'historial incluye cancelado',
);
assert.equal(history.length, 2);
expectStatus(
  await request(
    'PATCH',
    `${servicePath}/${firstService.id}`,
    { agreedAmountCop: 1 },
    ownerCookie,
  ),
  409,
  'acuerdo cancelado no se edita',
);

expectStatus(
  await request('DELETE', `/events/${event.id}`, undefined, ownerCookie),
  200,
  'cancelar evento',
);
const cancelledBudget = expectStatus(
  await request('GET', budgetPath, undefined, ownerCookie),
  200,
  'historial de presupuesto cancelado',
);
assert.equal(cancelledBudget.eventStatus, 'cancelado');
const overview = expectStatus(
  await request('GET', '/budgets', undefined, ownerCookie),
  200,
  'totales excluyen evento cancelado',
);
assert.equal(overview.totals.allocatedCop, 0);
assert.equal(overview.totals.spentCop, 0);
expectStatus(
  await request('GET', budgetPath, undefined, secondTenant.cookie),
  404,
  'otra empresa no ve presupuesto',
);
expectStatus(
  await request(
    'POST',
    servicePath,
    {
      providerId: provider.id,
      serviceName: 'Otro servicio',
      startDate: '2026-12-05',
      agreedAmountCop: 1000,
    },
    ownerCookie,
  ),
  409,
  'evento cancelado no acepta asignaciones',
);
expectStatus(
  await request(
    'GET',
    `${servicePath}?includeCancelled=true`,
    undefined,
    ownerCookie,
  ),
  200,
  'evento cancelado permite consulta',
);
expectStatus(
  await request(
    'DELETE',
    `${servicePath}/${secondService.id}`,
    undefined,
    ownerCookie,
  ),
  200,
  'evento cancelado permite cancelar acuerdo',
);
expectStatus(
  await request('GET', servicePath, undefined, secondTenant.cookie),
  404,
  'otra empresa no ve acuerdos del evento',
);

process.stdout.write(
  `Integración completa: ${checks} respuestas HTTP verificadas.\n`,
);
