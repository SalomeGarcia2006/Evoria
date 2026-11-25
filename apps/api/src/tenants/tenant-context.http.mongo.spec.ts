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
        emailDomain: 'EmpresaX.COM',
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
        emailDomain: string;
        sector: string;
        eventTypes: string[];
        operationMode: string;
        operationalAreas: Array<{ name: string }>;
      };
    };
    assert.equal(updatedContext.data.emailDomain, 'empresax.com');
    assert.equal(updatedContext.data.sector, 'Eventos corporativos');
    assert.deepEqual(updatedContext.data.eventTypes, [
      'Congresos',
      'Lanzamientos',
    ]);
    assert.equal(updatedContext.data.operationMode, 'ambos');
    assert.equal(updatedContext.data.operationalAreas[0].name, 'Finanzas');

    const link = await api.request('tenants/registration-link', {
      session: ownerSession,
    });
    assert.equal(link.status, 200);
    const linkBody = (await link.json()) as {
      data: { token: string; emailDomain: string };
    };
    assert.match(linkBody.data.token, /^[a-f0-9]{64}$/);
    assert.equal(linkBody.data.emailDomain, 'empresax.com');
    const sameLink = await api.request('tenants/registration-link', {
      session: ownerSession,
    });
    assert.equal((await sameLink.json()).data.token, linkBody.data.token);
    const rotatedLink = await api.request('tenants/registration-link/rotate', {
      method: 'POST',
      session: ownerSession,
    });
    assert.equal(rotatedLink.status, 201);
    assert.notEqual((await rotatedLink.json()).data.token, linkBody.data.token);

    const invalidUpdate = await api.request('tenants/context', {
      method: 'PATCH',
      session: ownerSession,
      body: { operationMode: 'invalida' },
    });
    assert.equal(invalidUpdate.status, 400);

    assert.equal(
      (
        await api.request('tenants/context', {
          method: 'PATCH',
          session: ownerSession,
          body: { emailDomain: '@empresa.com' },
        })
      ).status,
      400,
    );

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
    const restrictedUser = await api.createUserFixture({
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
          body: { emailDomain: 'EMPRESAX.com' },
        })
      ).status,
      409,
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

test('HTTP: conserva el propietario y permite identificar empresas antiguas sin cruzar empresas', async () => {
  const api = await createHttpTestApi('tenant_owner_test');
  try {
    const { ownerSession, developerSession, tenantId } =
      await createTenantTestContext(api);
    const initial = await api.request('tenants/context', {
      session: ownerSession,
    });
    assert.equal(initial.status, 200);
    const context = (await initial.json()) as {
      data: { nit: string; owner: { id: string; name: string; email: string } };
    };
    assert.equal(context.data.nit, '900123456-7');
    assert.equal(context.data.owner.name, 'Administrador de prueba');
    assert.equal(context.data.owner.email, 'owner@example.test');
    const ownerId = context.data.owner.id;
    const otherTenant = await api.request('tenants', {
      method: 'POST',
      session: developerSession,
      body: {
        name: 'Otra empresa',
        nit: '800123456-7',
        ownerName: 'Otra persona',
        ownerEmail: 'otra@example.test',
        ownerPassword: 'Prueba-segura1',
      },
    });
    assert.equal(otherTenant.status, 201);
    const otherOwnerId = (await otherTenant.json()).data.administrator
      .id as string;
    await api.connection
      .collection('tenants')
      .updateOne(
        { _id: new Types.ObjectId(tenantId) },
        { $unset: { ownerId: '' } },
      );
    const legacy = await api.request('tenants/context', {
      session: ownerSession,
    });
    assert.equal((await legacy.json()).data.owner, null);
    assert.equal(
      (
        await api.request('tenants/context/owner', {
          method: 'PATCH',
          session: ownerSession,
          body: { userId: ownerId },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await api.request(`tenants/${tenantId}/join`, {
          method: 'POST',
          session: developerSession,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api.request('tenants/context/owner', {
          method: 'PATCH',
          session: developerSession,
          body: { userId: otherOwnerId },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await api.request('tenants/context/owner', {
          method: 'PATCH',
          session: developerSession,
          body: { userId: new Types.ObjectId().toString() },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await api.request('tenants/context/owner', {
          method: 'PATCH',
          session: developerSession,
          body: { userId: 'invalido' },
        })
      ).status,
      400,
    );
    const assigned = await api.request('tenants/context/owner', {
      method: 'PATCH',
      session: developerSession,
      body: { userId: ownerId },
    });
    assert.equal(assigned.status, 200);
    assert.equal((await assigned.json()).data.owner.id, ownerId);
    const reloaded = await api.request('tenants/context', {
      session: ownerSession,
    });
    assert.equal(
      (await reloaded.json()).data.owner.email,
      'owner@example.test',
    );
    assert.equal(
      (
        await api.request('tenants/context/owner', {
          method: 'PATCH',
          session: developerSession,
          body: { userId: ownerId },
        })
      ).status,
      409,
    );
  } finally {
    await api.close();
  }
});
