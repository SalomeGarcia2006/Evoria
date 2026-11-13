import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import {
  createHttpTestApi,
  createTenantTestContext,
} from '../testing/http-test-api';

test('HTTP: el contexto operativo se administra de forma aislada por empresa', async () => {
  const api = await createHttpTestApi('tenant_context_test');
  try {
    const { developerSession, ownerSession, tenantId } =
      await createTenantTestContext(api);

    const initialContext = await api.request('tenants/context', {
      session: ownerSession,
    });
    assert.equal(initialContext.status, 200);
    const initialContextBody = (await initialContext.json()) as {
      data: {
        id: string;
        sector: null;
        eventTypes: string[];
        operationalAreas: unknown[];
      };
    };
    assert.ok(initialContextBody.data.id);
    assert.equal(initialContextBody.data.sector, null);
    assert.deepEqual(initialContextBody.data.eventTypes, []);
    assert.deepEqual(initialContextBody.data.operationalAreas, []);

    await api.connection
      .collection('profiles')
      .updateOne(
        { name: 'Administrador', tenantId: new Types.ObjectId(tenantId) },
        { $set: { permissionIds: [] } },
      );
    await api.seedAccessControl();
    const repairedOwnerSession = await api.login(
      'owner@example.test',
      'Prueba-segura1',
    );
    assert.equal(
      (await api.request('tenants/context', { session: repairedOwnerSession }))
        .status,
      200,
    );

    const update = await api.request('tenants/context', {
      method: 'PATCH',
      session: ownerSession,
      body: {
        sector: 'Eventos corporativos',
        operationalDescription: 'Diseña y ejecuta eventos para clientes.',
        eventTypes: ['Congresos', 'Lanzamientos'],
        operationMode: 'ambos',
        operationalAreas: [
          {
            name: 'Finanzas',
            description: 'Administra costos y pagos.',
            responsibilities: ['Controlar el presupuesto'],
            authorizations: ['Aprobar gastos extraordinarios'],
          },
        ],
        operationalNotes: 'Contexto inicial.',
      },
    });
    assert.equal(update.status, 200);
    const updatedContext = (await update.json()) as {
      data: {
        sector: string;
        eventTypes: string[];
        operationMode: string;
        operationalAreas: Array<{ name: string }>;
      };
    };
    assert.equal(updatedContext.data.sector, 'Eventos corporativos');
    assert.deepEqual(updatedContext.data.eventTypes, [
      'Congresos',
      'Lanzamientos',
    ]);
    assert.equal(updatedContext.data.operationMode, 'ambos');
    assert.equal(updatedContext.data.operationalAreas[0].name, 'Finanzas');

    const invalidUpdate = await api.request('tenants/context', {
      method: 'PATCH',
      session: ownerSession,
      body: { operationMode: 'invalida' },
    });
    assert.equal(invalidUpdate.status, 400);

    const auditLogs = await api.request('audit-logs?module=empresa_contexto', {
      session: ownerSession,
    });
    assert.equal(auditLogs.status, 200);
    const auditBody = (await auditLogs.json()) as {
      data: { items: Array<{ action: string; entity: string }> };
    };
    assert.ok(
      auditBody.data.items.some(
        (item) => item.action === 'editar' && item.entity === 'empresa',
      ),
    );

    const restrictedProfile = await api.request('profiles', {
      method: 'POST',
      session: ownerSession,
      body: {
        name: 'Sin contexto operativo',
        description: 'No puede consultar ni editar el contexto.',
        permissionKeys: ['eventos.ver'],
      },
    });
    assert.equal(restrictedProfile.status, 201);
    const profile = (await restrictedProfile.json()) as {
      data: { id: string };
    };
    const restrictedUser = await api.request('users', {
      method: 'POST',
      session: ownerSession,
      body: {
        name: 'Usuario restringido',
        email: 'restricted@example.test',
        password: 'Prueba-segura1',
        profileId: profile.data.id,
      },
    });
    assert.equal(restrictedUser.status, 201);
    const restrictedSession = await api.login(
      'restricted@example.test',
      'Prueba-segura1',
    );
    assert.equal(
      (await api.request('tenants/context', { session: restrictedSession }))
        .status,
      403,
    );
    assert.equal(
      (
        await api.request('tenants/context', {
          method: 'PATCH',
          session: restrictedSession,
          body: { sector: 'No permitido' },
        })
      ).status,
      403,
    );

    const secondTenant = await api.request('tenants', {
      method: 'POST',
      session: developerSession,
      body: {
        name: 'Empresa independiente',
        nit: '900123457-8',
        ownerName: 'Otro administrador',
        ownerEmail: 'other-owner@example.test',
        ownerPassword: 'Prueba-segura1',
      },
    });
    assert.equal(secondTenant.status, 201);
    const secondTenantBody = (await secondTenant.json()) as {
      data: { id: string };
    };
    const otherOwner = await api.login(
      'other-owner@example.test',
      'Prueba-segura1',
    );
    assert.equal(
      (
        await api.request('tenants/context', {
          method: 'PATCH',
          session: otherOwner,
          body: { sector: 'Eventos culturales' },
        })
      ).status,
      200,
    );

    const deactivated = await api.request(
      `tenants/${secondTenantBody.data.id}`,
      {
        method: 'DELETE',
        session: developerSession,
      },
    );
    assert.equal(deactivated.status, 200);
    const deactivatedBody = (await deactivated.json()) as {
      data: { status: string };
    };
    assert.equal(deactivatedBody.data.status, 'inactivo');
    assert.equal(
      (await api.request('tenants/context', { session: otherOwner })).status,
      401,
    );
    const tenants = await api.request('tenants', { session: developerSession });
    assert.equal(tenants.status, 200);
    const tenantsBody = (await tenants.json()) as {
      data: Array<{ id: string }>;
    };
    assert.ok(
      !tenantsBody.data.some(
        (tenant) => tenant.id === secondTenantBody.data.id,
      ),
    );

    const firstTenantContext = await api.request('tenants/context', {
      session: ownerSession,
    });
    assert.equal(firstTenantContext.status, 200);
    const firstTenantBody = (await firstTenantContext.json()) as {
      data: { sector: string };
    };
    assert.equal(firstTenantBody.data.sector, 'Eventos corporativos');
  } finally {
    await api.close();
  }
});
