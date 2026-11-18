import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Types } from 'mongoose';
import { PDFDocument } from 'pdf-lib';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  createHttpTestApi,
  createTenantTestContext,
  type HttpSession,
} from '../testing/http-test-api';
import { ReportsPdfService } from './reports-pdf.service';
import { ExportReportQuery } from './reports.dto';
import { renderReportPdf } from './report-pdf.renderer';

test('HTTP: PDF empresarial, filtros, permisos y aislamiento', async (t) => {
  const api = await createHttpTestApi('reports_pdf', undefined, {
    send: async () => undefined,
  });
  try {
    const ctx = await createTenantTestContext(api);
    const owner = ctx.ownerSession;
    const ownerId = new Types.ObjectId(
      (owner.data as { user: { id: string } }).user.id,
    );
    const tenant = new Types.ObjectId(ctx.tenantId);
    const otherTenant = new Types.ObjectId(),
      foreignUser = new Types.ObjectId(),
      event = new Types.ObjectId(),
      team = new Types.ObjectId(),
      foreignEvent = new Types.ObjectId();
    const personIds = [ownerId, new Types.ObjectId(), new Types.ObjectId()];
    const ownerMembership = await api.connection
      .collection('memberships')
      .findOne({ userId: ownerId, tenantId: tenant });
    assert.ok(ownerMembership);
    const actor: AuthenticatedUser = {
      id: ownerId.toString(),
      name: 'Mariana Rodríguez',
      email: 'demo@example.test',
      scope: 'tenant',
      tenantId: ctx.tenantId,
      profileId: ownerMembership.profileId.toString(),
    };
    const service = api.get(ReportsPdfService);
    const allKeys = (
      await api.connection
        .collection('permissions')
        .find({ scope: 'tenant', status: 'activo' })
        .toArray()
    ).map((p) => p.key as string);
    await api.connection.collection('tenants').updateOne(
      { _id: tenant },
      {
        $set: {
          name: 'FORMA EVENTOS S.A.S.',
          nit: '900000001-1',
          sector: 'Producción y experiencias corporativas',
          operationalDescription:
            'Diseñamos y coordinamos experiencias empresariales, integrando producción técnica, logística y atención a los participantes. Este documento utiliza datos ficticios para demostrar la exportación de EVORIA.',
          eventTypes: [
            'Convenciones empresariales',
            'Lanzamientos de marca',
            'Encuentros de formación',
          ],
          operationMode: null,
          operationalAreas: [
            {
              name: 'Producción técnica',
              description:
                'Planeación y coordinación de montaje, sonido e iluminación.',
              responsibilities: [
                'Validación técnica',
                'Coordinación de proveedores',
              ],
              authorizations: [],
            },
            {
              name: 'Operaciones y logística',
              description:
                'Disponibilidad de recursos, cronogramas y atención en sitio.',
              responsibilities: [
                'Control de inventario',
                'Seguimiento de actividades',
              ],
              authorizations: [],
            },
          ],
          operationalNotes:
            'La información corresponde a un corte operativo para el seguimiento interno. Las cifras de presupuesto representan costos registrados y no certifican pagos realizados.',
          registrationToken: 'NO_EXPORTAR_TOKEN_PRIVADO',
        },
      },
    );
    await api.connection.collection('users').insertMany([
      {
        _id: personIds[1],
        name: 'Andrés Méndez',
        email: 'andres@example.test',
        status: 'activo',
      },
      {
        _id: personIds[2],
        name: 'Valentina Ríos',
        email: 'valentina@example.test',
        status: 'activo',
      },
      {
        _id: foreignUser,
        name: 'NOMBRE_SECRETO_OTRA_EMPRESA',
        email: 'foreign@example.test',
        status: 'activo',
      },
    ]);
    await api.connection.collection('memberships').insertMany(
      personIds.slice(1).map((userId) => ({
        tenantId: tenant,
        userId,
        profileId: ownerMembership.profileId,
        status: 'activo',
      })),
    );
    await api.connection.collection('memberships').insertOne({
      tenantId: otherTenant,
      userId: foreignUser,
      profileId: new Types.ObjectId(),
      status: 'activo',
    });
    const events = Array.from({ length: 8 }, (_, i) => ({
      _id: i === 0 ? event : new Types.ObjectId(),
      tenantId: tenant,
      name:
        [
          'Convención anual de liderazgo 2026',
          'Lanzamiento de la nueva línea de servicios',
          'Encuentro de aliados y proveedores',
          'Jornada de formación del equipo comercial',
        ][i % 4] + (i > 3 ? ' - Región norte' : ''),
      description:
        'Un encuentro diseñado para compartir resultados, alinear prioridades y fortalecer la colaboración entre equipos. Incluye producción técnica, recepción de participantes y desarrollo de sesiones de trabajo.',
      location: 'Centro de convenciones - Bogotá, Colombia',
      type: 'Convención empresarial',
      status:
        i === 0 ? 'planificado' : i % 3 === 0 ? 'finalizado' : 'en_progreso',
      startAt: new Date(`2026-12-${String(10 + i).padStart(2, '0')}T13:00:00Z`),
      endAt: new Date(`2026-12-${String(10 + i).padStart(2, '0')}T23:00:00Z`),
      baseBudget: 48000000,
      invitados: 120 + i * 10,
      responsibleUserId: ownerId,
      createdBy: ownerId,
    }));
    await api.connection.collection('events').insertMany([
      ...events,
      {
        ...events[0],
        _id: foreignEvent,
        tenantId: otherTenant,
        name: 'EVENTO_SECRETO_OTRA_EMPRESA',
      },
    ]);
    await api.connection.collection('event_budgets').insertMany(
      events.map((ev) => ({
        tenantId: tenant,
        eventId: ev._id,
        baseAmountCop: 48000000,
        approvedIncreaseCop: 6000000,
        inventorySpentCop: 9200000,
        providerSpentCop: 12400000,
        extraSpentCop: 1800000,
        requests: [],
        createdBy: ownerId,
      })),
    );
    const names = [
      'Silla ejecutiva tapizada',
      'Mesa de apoyo modular',
      'Pantalla LED para escenario',
      'Micrófono inalámbrico de mano',
      'Sistema de sonido profesional',
      'Atril de conferencias',
      'Panel de señalización corporativa',
      'Luminaria de escenario',
      'Estación de acreditación',
      'Carpa de recepción',
      'Equipo de transmisión',
      'Tarima modular',
    ];
    const items = Array.from({ length: 28 }, (_, i) => ({
      _id: new Types.ObjectId(),
      tenantId: tenant,
      name:
        names[i % names.length] +
        (i >= names.length ? ` / Serie ${i + 1}` : ''),
      type: i % 3 === 0 ? 'Mobiliario' : 'Producción técnica',
      status: i % 9 === 0 ? 'mantenimiento' : 'disponible',
      totalQuantity: 40 + i * 2,
      availableQuantity: i % 5 === 0 ? 4 : 25 + i,
      reservedQuantity: i % 5 === 0 ? 36 + i * 2 : 15 + i,
      unitCost: 50000,
      createdBy: ownerId,
    }));
    await api.connection.collection('resources').insertMany(items);
    await api.connection.collection('event_resources').insertMany(
      items.slice(0, 8).map((item, i) => ({
        tenantId: tenant,
        eventId: event,
        inventoryItemId: item._id,
        quantity: i + 2,
        costAmountCop: 450000 + i * 200000,
        status: 'asignado',
        assignedAt: new Date('2026-11-17T15:00:00Z'),
      })),
    );
    const providerIds = [
      new Types.ObjectId(),
      new Types.ObjectId(),
      new Types.ObjectId(),
    ];
    await api.connection.collection('providers').insertMany(
      providerIds.map((id, i) => ({
        _id: id,
        tenantId: tenant,
        name: [
          'Técnica y Escena S.A.S.',
          'Sabores de Origen',
          'Logística Integral Andina',
        ][i],
        status: 'activo',
        categoryKeys: ['espacios'],
        createdBy: ownerId,
      })),
    );
    await api.connection.collection('event_provider_services').insertMany(
      providerIds.map((id, i) => ({
        _id: new Types.ObjectId(),
        tenantId: tenant,
        eventId: event,
        providerId: id,
        serviceName: [
          'Sonido, iluminación y operación técnica',
          'Servicio de alimentación y estaciones de café',
          'Recepción y transporte del equipo de producción',
        ][i],
        startDate: '2026-12-10',
        startTime: '08:00',
        agreedAmountCop: [12400000, 5200000, 1800000][i],
        status: i === 0 ? 'confirmado' : 'pendiente',
        assignedBy: ownerId,
      })),
    );
    await api.connection.collection('teams').insertMany([
      {
        _id: team,
        tenantId: tenant,
        name: 'Equipo de producción y experiencias',
        specialty: 'Producción técnica y logística',
        leaderId: personIds[1],
        memberIds: personIds,
        status: 'activo',
        createdBy: ownerId,
      },
      {
        _id: new Types.ObjectId(),
        tenantId: tenant,
        name: 'Equipo con referencia externa inválida',
        specialty: 'Control de acceso',
        leaderId: foreignUser,
        memberIds: [foreignUser],
        status: 'activo',
        createdBy: ownerId,
      },
    ]);
    const taskNames = [
      'Confirmación de requerimientos técnicos',
      'Recepción y validación de inventario',
      'Montaje de escenario y señalización',
      'Pruebas de sonido e iluminación',
      'Acreditación de participantes',
      'Apertura y bienvenida institucional',
      'Sesiones de trabajo y acompañamiento',
      'Verificación de cierre y devolución de recursos',
    ];
    await api.connection.collection('schedules').insertMany(
      Array.from({ length: 16 }, (_, i) => ({
        tenantId: tenant,
        eventId: event,
        teamId: team,
        name:
          taskNames[i % taskNames.length] + (i > 7 ? ' / Segundo bloque' : ''),
        status: ['completado', 'en_progreso', 'pendiente'][i % 3],
        startAt: new Date(Date.UTC(2026, 11, 10, 12 + Math.floor(i / 2), 0)),
        endAt: new Date(Date.UTC(2026, 11, 10, 13 + Math.floor(i / 2), 0)),
      })),
    );
    await api.connection.collection('schedules').insertOne({
      tenantId: tenant,
      eventId: foreignEvent,
      teamId: team,
      name: 'ACTIVIDAD_SECRETA_REFERENCIA_EXTERNA',
      status: 'pendiente',
      startAt: new Date(),
      endAt: new Date(),
    });
    const get = (url: string, session: HttpSession = owner) =>
      api.request(url, { session });
    async function validPdf(url: string) {
      const response = await get(url);
      if (response.status !== 200)
        throw new Error(
          `Exportación fallida (${response.status}): ${(await response.text()).slice(0, 200)}`,
        );
      assert.match(
        response.headers.get('content-type') ?? '',
        /application\/pdf/,
      );
      assert.match(
        response.headers.get('content-disposition') ?? '',
        /attachment; filename="evoria-.*\.pdf"/,
      );
      assert.match(response.headers.get('cache-control') ?? '', /no-store/);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
      const pdf = await PDFDocument.load(bytes);
      assert.ok(pdf.getPageCount() > 0);
      assert.match(pdf.getTitle() ?? '', /FORMA EVENTOS/);
      return pdf;
    }
    await t.test(
      'exporta los seis reportes existentes como PDF y mantiene CSV por defecto',
      async () => {
        for (const kind of [
          'events',
          'budgets',
          'inventory',
          'resources',
          'providers',
          'schedules',
        ])
          await validPdf(`reports/export/${kind}?format=pdf&page=2&limit=1`);
        const csv = await get('reports/export/events');
        assert.equal(csv.status, 200);
        assert.match(csv.headers.get('content-type') ?? '', /text\/csv/);
        assert.match(await csv.text(), /Convención anual/);
        const payload = await service.document(
          'events',
          Object.assign(new ExportReportQuery(), { eventId: event.toString() }),
          actor,
        );
        assert.equal(payload.metrics[0].value, '1');
      },
    );
    await t.test(
      'genera fichas de evento, empresa y equipo, con referencias seguras y datos reales',
      async () => {
        await validPdf(
          `reports/export/event?format=pdf&eventId=${event.toString()}`,
        );
        await validPdf('reports/export/company?format=pdf');
        await validPdf(
          `reports/export/teams?format=pdf&teamId=${team.toString()}`,
        );
        const dossier = await service.document(
          'event',
          Object.assign(new ExportReportQuery(), { eventId: event.toString() }),
          actor,
        );
        const budget = dossier.sections.find((s) => s.kind === 'budget');
        assert.ok(budget?.kind === 'budget');
        assert.equal(budget.allocated, 54000000);
        assert.equal(budget.spent, 23400000);
        const teamReport = await service.document(
          'teams',
          Object.assign(new ExportReportQuery(), { teamId: team.toString() }),
          actor,
        );
        const allTeams = await service.document(
          'teams',
          new ExportReportQuery(),
          actor,
        );
        const company = await service.document(
          'company',
          new ExportReportQuery(),
          actor,
        );
        for (const document of [dossier, teamReport, allTeams, company]) {
          const json = JSON.stringify(document);
          assert.doesNotMatch(
            json,
            /NOMBRE_SECRETO_OTRA_EMPRESA|EVENTO_SECRETO_OTRA_EMPRESA|ACTIVIDAD_SECRETA_REFERENCIA_EXTERNA|NO_EXPORTAR_TOKEN_PRIVADO/,
          );
        }
        if (process.env.EVORIA_PDF_QA_DIR) {
          const directory = path.resolve(process.env.EVORIA_PDF_QA_DIR);
          await mkdir(directory, { recursive: true });
          for (const [name, document] of [
            ['evento', dossier],
            ['empresa', company],
            ['equipo', teamReport],
            [
              'inventario',
              await service.document(
                'inventory',
                new ExportReportQuery(),
                actor,
              ),
            ],
          ] as const) {
            document.sampleNotice =
              'DEMOSTRACIÓN VISUAL - Datos ficticios para revisar el diseño del reporte.';
            await writeFile(
              path.join(directory, `ejemplo-${name}.pdf`),
              await renderReportPdf(document),
            );
          }
        }
      },
    );
    await t.test(
      'bloquea entidades ajenas y valida el formato, filtros e identificadores',
      async () => {
        assert.equal(
          (
            await get(
              `reports/export/event?format=pdf&eventId=${foreignEvent.toString()}`,
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await get(
              `reports/export/teams?format=pdf&teamId=${new Types.ObjectId().toString()}`,
            )
          ).status,
          404,
        );
        for (const url of [
          'reports/export/event?format=pdf',
          'reports/export/events?format=xml',
          'reports/export/inventory?format=pdf&from=2026-01-01',
          'reports/export/teams?format=pdf&teamId=invalid',
          'reports/export/teams?format=pdf&from=2026-01-01',
          'reports/export/company?format=pdf&from=2027-01-01&to=2026-01-01',
          'reports/export/events?format=pdf&eventId=invalid',
          'reports/export/company?format=csv',
          'reports/export/unknown?format=pdf',
        ])
          assert.equal((await get(url)).status, 400, url);
        assert.equal(
          (await api.request('reports/export/company?format=pdf')).status,
          401,
        );
      },
    );
    await t.test(
      'el PDF respeta permisos de presupuesto, usuarios y contexto de empresa',
      async () => {
        const keys = allKeys.filter(
          (key) =>
            ![
              'presupuestos.ver',
              'usuarios.ver',
              'empresa_contexto.ver',
            ].includes(key),
        );
        const response = await api.request('profiles', {
          method: 'POST',
          session: owner,
          body: {
            name: 'Reportes sin finanzas ni directorio',
            description: 'Prueba de privacidad',
            permissionKeys: keys,
          },
        });
        assert.equal(response.status, 201);
        const profile = (await response.json()) as { data: { id: string } };
        const created = await api.createUserFixture({
          body: {
            name: 'Consulta restringida',
            email: 'restricted-pdf@example.test',
            password: 'Prueba-segura1',
            profileId: profile.data.id,
          },
        });
        assert.equal(created.status, 201);
        const createdBody = (await created.json()) as { data: { id: string } };
        const registered = {
          id: createdBody.data.id,
          email: 'restricted-pdf@example.test',
          password: 'Prueba-segura1',
        };
        const restricted = await api.login(
          registered.email,
          registered.password,
        );
        const user: AuthenticatedUser = {
          ...actor,
          id: registered.id,
          name: 'Consulta restringida',
          email: registered.email,
          profileId: profile.data.id,
        };
        const document = await service.document(
          'event',
          Object.assign(new ExportReportQuery(), { eventId: event.toString() }),
          user,
        );
        assert.doesNotMatch(
          JSON.stringify(document),
          /54000000|54\.000\.000|23400000|23\.400\.000|Andrés Méndez|Valentina Ríos|900000001/,
        );
        assert.equal(
          (await get('reports/export/budgets?format=pdf', restricted)).status,
          403,
        );
        assert.equal(
          (await get('reports/export/company?format=pdf', restricted)).status,
          403,
        );
        const allowed = await get(
          `reports/export/event?format=pdf&eventId=${event.toString()}`,
          restricted,
        );
        assert.equal(allowed.status, 200);
        await api.connection
          .collection('permissions')
          .updateOne({ key: 'reportes.ver' }, { $set: { status: 'inactivo' } });
        assert.equal(
          (await get('reports/export/events?format=pdf', restricted)).status,
          403,
        );
        await api.connection
          .collection('permissions')
          .updateOne({ key: 'reportes.ver' }, { $set: { status: 'activo' } });
        await api.connection
          .collection('memberships')
          .updateOne(
            { tenantId: tenant, userId: new Types.ObjectId(registered.id) },
            { $set: { status: 'inactivo' } },
          );
        assert.equal(
          (await get('reports/export/events?format=pdf', restricted)).status,
          401,
        );
      },
    );
    await t.test(
      'más de 500 filas se rechazan sin un archivo truncado',
      async () => {
        await api.connection.collection('resources').insertMany(
          Array.from({ length: 501 }, (_, i) => ({
            tenantId: tenant,
            name: `Límite PDF ${i}`,
            type: 'Prueba',
            status: 'disponible',
            totalQuantity: 1,
            availableQuantity: 1,
            reservedQuantity: 0,
          })),
        );
        const response = await get('reports/export/inventory?format=pdf');
        assert.equal(response.status, 400);
        assert.match(
          response.headers.get('content-type') ?? '',
          /application\/json/,
        );
        assert.match(await response.text(), /500 registros/);
        await validPdf(
          'reports/export/inventory?format=pdf&inventoryStatus=mantenimiento',
        );
      },
    );
  } finally {
    await api.close();
  }
});
