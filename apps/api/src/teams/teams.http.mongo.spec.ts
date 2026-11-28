import { eventClientFixture } from '../testing/event-client.fixture';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import {
  createHttpTestApi,
  createTenantTestContext,
} from '../testing/http-test-api';

test('equipos respetan empresa, permisos, horarios y finalización', async () => {
  const api = await createHttpTestApi('teams_test');
  try {
    const { ownerSession, developerSession } =
      await createTenantTestContext(api);
    const owner = await api.connection
      .collection('users')
      .findOne({ email: 'owner@example.test' });
    assert.ok(owner);
    const ownerId = owner._id.toString();
    const request = (path: string, method: string, body?: unknown) =>
      api.request(path, { method, body, session: ownerSession });
    assert.equal(
      (await request('teams/specialties', 'POST', { name: 'Escenografía' }))
        .status,
      201,
    );
    assert.equal(
      (await request('teams/specialties', 'POST', { name: 'escenografía' }))
        .status,
      409,
    );
    const specialties = await request('teams/specialties', 'GET');
    assert.ok(
      ((await specialties.json()) as { data: string[] }).data.includes(
        'Escenografía',
      ),
    );
    const profileResponse = await request('profiles', 'POST', {
      name: 'Colaborador',
      description: 'Perfil de colaboración',
      permissionKeys: ['cronogramas.ver'],
    });
    assert.equal(profileResponse.status, 201);
    const profile = (await profileResponse.json()) as { data: { id: string } };
    assert.equal(
      (
        await api.createUserFixture({
          body: {
            name: 'Colaborador',
            email: 'member@example.test',
            password: 'Prueba-segura1',
            profileId: profile.data.id,
          },
        })
      ).status,
      201,
    );
    const memberSession = await api.login(
      'member@example.test',
      'Prueba-segura1',
    );
    const member = await api.connection
      .collection('users')
      .findOne({ email: 'member@example.test' });
    assert.ok(member);
    const memberId = member._id.toString();
    assert.equal(
      (
        await api.createUserFixture({
          body: {
            name: 'Usuario concurrente',
            email: 'racer@example.test',
            password: 'Prueba-segura1',
            profileId: profile.data.id,
          },
        })
      ).status,
      201,
    );
    const racer = await api.connection
      .collection('users')
      .findOne({ email: 'racer@example.test' });
    assert.ok(racer);
    const raceResults = await Promise.all([
      request('teams', 'POST', {
        name: 'Equipo concurrente',
        specialty: 'Seguridad',
        memberIds: [racer._id.toString()],
        leaderId: racer._id.toString(),
      }),
      request(`users/${racer._id.toString()}`, 'DELETE'),
    ]);
    assert.ok(
      (raceResults[0].status === 201 && raceResults[1].status === 409) ||
        (raceResults[0].status === 400 && raceResults[1].status === 200),
    );
    const raceMember = await api.connection
      .collection('memberships')
      .findOne({ userId: racer._id });
    const raceTeam = await api.connection
      .collection('teams')
      .findOne({ memberIds: racer._id, status: 'activo' });
    assert.ok(!raceTeam || raceMember?.status === 'activo');
    const memberTeamResponse = await request('teams', 'POST', {
      name: 'Equipo logística',
      specialty: 'Logística',
      memberIds: [memberId],
      leaderId: memberId,
    });
    assert.equal(memberTeamResponse.status, 201);
    const memberTeam = (await memberTeamResponse.json()) as {
      data: { id: string };
    };
    assert.equal((await request(`users/${memberId}`, 'DELETE')).status, 409);
    const teamResponse = await request('teams', 'POST', {
      name: 'Equipo sonido',
      specialty: 'Sonido',
      memberIds: [ownerId],
      leaderId: ownerId,
    });
    assert.equal(teamResponse.status, 201);
    const team = (await teamResponse.json()) as { data: { id: string } };
    assert.equal(
      (
        await api.request('teams', {
          method: 'POST',
          session: memberSession,
          body: {
            name: 'Sin permiso',
            specialty: 'Sonido',
            memberIds: [ownerId],
            leaderId: ownerId,
          },
        })
      ).status,
      403,
    );
    const duplicate = await request('teams', 'POST', {
      name: 'Otro equipo',
      specialty: 'Logística',
      memberIds: [ownerId],
      leaderId: ownerId,
    });
    assert.equal(duplicate.status, 409);
    assert.equal(
      (await api.request('teams', { session: developerSession })).status,
      403,
    );

    const otherUser = new Types.ObjectId();
    const invalidMember = await request('teams', 'POST', {
      name: 'Equipo externo',
      specialty: 'Limpieza',
      memberIds: [otherUser.toString()],
      leaderId: otherUser.toString(),
    });
    assert.equal(invalidMember.status, 400);

    const now = Date.now();
    const start = new Date(now + 3600000);
    const hour = 3600000;
    async function event(name: string, responsibleUserId = ownerId) {
      const response = await request('events', 'POST', {
        client: eventClientFixture(),
        name,
        startAt: start.toISOString(),
        endAt: new Date(start.getTime() + 10 * hour).toISOString(),
        baseBudget: 0,
        responsibleUserId,
      });
      assert.equal(response.status, 201);
      return ((await response.json()) as { data: { id: string } }).data.id;
    }
    const eventA = await event('Evento principal');
    const eventB = await event('Segundo evento');
    const eventWithoutAlerts = await event(
      'Evento sin permisos de alerta',
      memberId,
    );
    async function activity(
      eventId: string,
      name: string,
      begin: number,
      end: number,
    ) {
      const response = await request(`events/${eventId}/schedules`, 'POST', {
        name,
        responsibleUserId: memberId,
        startAt: new Date(start.getTime() + begin * 60000).toISOString(),
        endAt: new Date(start.getTime() + end * 60000).toISOString(),
      });
      assert.equal(response.status, 201);
      const result = (await response.json()) as {
        data: { id: string; responsibleUserId: string | null };
      };
      assert.equal(result.data.responsibleUserId, null);
      return result.data.id;
    }
    const first = await activity(eventA, 'Primera actividad', 0, 60);
    const noAlertsActivity = await activity(
      eventWithoutAlerts,
      'Actividad sin alertas',
      500,
      530,
    );
    assert.equal(
      (
        await api.request(`schedules/${noAlertsActivity}/team`, {
          method: 'POST',
          session: memberSession,
          body: { teamId: team.data.id },
        })
      ).status,
      409,
    );
    const sameTooClose = await activity(eventA, 'Muy cercana', 74, 90);
    const sameAllowed = await activity(eventA, 'Con descanso', 75, 90);
    const otherTooClose = await activity(
      eventB,
      'Otro evento cercano',
      91,
      100,
    );
    const otherAllowed = await activity(
      eventB,
      'Otro evento con descanso',
      150,
      165,
    );
    async function assign(id: string) {
      return request(`schedules/${id}/team`, 'POST', { teamId: team.data.id });
    }
    assert.equal(
      (
        await api.request(`schedules/${first}/team`, {
          method: 'POST',
          session: memberSession,
          body: { teamId: team.data.id },
        })
      ).status,
      403,
    );
    assert.equal((await assign(first)).status, 201);
    async function responsible(id: string) {
      const response = await request(`events/${eventA}/schedules`, 'GET');
      assert.equal(response.status, 200);
      const result = (await response.json()) as {
        data: { id: string; responsibleUserId: string | null }[];
      };
      return result.data.find((item) => item.id === id)?.responsibleUserId;
    }
    assert.equal(await responsible(first), ownerId);
    assert.equal(
      (
        await api.createUserFixture({
          body: {
            name: 'Nuevo líder',
            email: 'nuevo-lider@example.test',
            password: 'Prueba-segura1',
            profileId: profile.data.id,
          },
        })
      ).status,
      201,
    );
    const newLeader = await api.connection
      .collection('users')
      .findOne({ email: 'nuevo-lider@example.test' });
    assert.ok(newLeader);
    const newLeaderId = newLeader._id.toString();
    assert.equal(
      (
        await request(`teams/${team.data.id}`, 'PATCH', {
          memberIds: [ownerId, newLeaderId],
          leaderId: newLeaderId,
        })
      ).status,
      200,
    );
    assert.equal(await responsible(first), newLeaderId);
    assert.equal(
      (
        await request(`teams/${team.data.id}`, 'PATCH', {
          memberIds: [ownerId],
          leaderId: ownerId,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request(`events/${eventA}`, 'PATCH', {
          endAt: new Date(start.getTime() + 30 * 60000).toISOString(),
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request(`events/${eventA}`, 'PATCH', {
          responsibleUserId: memberId,
        })
      ).status,
      409,
    );
    const availability = await request(
      `schedules/${sameTooClose}/available-teams`,
      'GET',
    );
    assert.equal(availability.status, 200);
    const available = (await availability.json()) as {
      data: Array<{ id: string }>;
    };
    assert.ok(!available.data.some((item) => item.id === team.data.id));
    assert.ok(available.data.some((item) => item.id === memberTeam.data.id));
    assert.equal(
      (
        await api.request(`schedules/${sameTooClose}/available-teams`, {
          session: memberSession,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await api.request(`schedules/${first}/complete`, {
          method: 'POST',
          session: memberSession,
        })
      ).status,
      403,
    );
    assert.equal((await assign(sameTooClose)).status, 409);
    const raceA = await activity(eventA, 'Actividad concurrente uno', 300, 330);
    const raceB = await activity(eventA, 'Actividad concurrente dos', 305, 335);
    const concurrent = await Promise.all([assign(raceA), assign(raceB)]);
    assert.deepEqual(
      concurrent.map((response) => response.status).sort(),
      [201, 409],
    );
    assert.equal((await assign(sameAllowed)).status, 201);
    assert.equal((await assign(otherTooClose)).status, 409);
    assert.equal((await assign(otherAllowed)).status, 201);
    assert.equal(
      (await request(`schedules/${first}`, 'PATCH', { name: 'No permitido' }))
        .status,
      409,
    );
    assert.equal(
      (await request(`teams/${team.data.id}`, 'DELETE')).status,
      409,
    );
    const complete = await request(`schedules/${first}/complete`, 'POST');
    assert.equal(complete.status, 201);
    const firstHistory = await request(
      `schedules/${first}/team-history`,
      'GET',
    );
    const history = (await firstHistory.json()) as {
      data: Array<{ action: string; actorId: string }>;
    };
    assert.deepEqual(
      history.data.map((entry) => entry.action),
      ['asignado', 'completado'],
    );
    assert.ok(history.data.every((entry) => entry.actorId === ownerId));
    const fallbackActivity = await activity(
      eventA,
      'Actividad del equipo de logística',
      390,
      420,
    );
    assert.equal(
      (
        await request(`schedules/${fallbackActivity}/team`, 'POST', {
          teamId: memberTeam.data.id,
        })
      ).status,
      201,
    );
    assert.equal(
      (await request(`schedules/${fallbackActivity}/complete`, 'POST')).status,
      201,
    );
    const fallbackHistory = await request(
      `schedules/${fallbackActivity}/team-history`,
      'GET',
    );
    const fallbackEntries = (await fallbackHistory.json()) as {
      data: Array<{ action: string; actorId: string }>;
    };
    assert.equal(fallbackEntries.data[1].actorId, ownerId);
    const alert = await api.connection
      .collection('alert_outbox')
      .findOne({ dedupeKey: `activity-completed:${first}` });
    assert.ok(alert);
    assert.equal(alert.recipientId.toString(), ownerId);
    assert.equal(
      (await request(`schedules/${sameAllowed}/team`, 'DELETE')).status,
      200,
    );
    assert.equal(await responsible(sameAllowed), null);
    const removedHistory = await request(
      `schedules/${sameAllowed}/team-history`,
      'GET',
    );
    assert.deepEqual(
      (
        (await removedHistory.json()) as { data: Array<{ action: string }> }
      ).data.map((entry) => entry.action),
      ['asignado', 'retirado'],
    );
    assert.equal(
      (
        await request(`schedules/${sameAllowed}`, 'PATCH', {
          name: 'Nombre editado',
        })
      ).status,
      200,
    );
    assert.equal(
      (await request(`schedules/${sameAllowed}`, 'DELETE')).status,
      200,
    );
    assert.equal((await assign(sameTooClose)).status, 409);
    await api.connection
      .collection('schedules')
      .updateOne(
        { _id: new Types.ObjectId(otherAllowed) },
        { $set: { endAt: new Date(Date.now() - 1000) } },
      );
    const deadline = Date.now() + 25000;
    let automatic;
    while (Date.now() < deadline) {
      automatic = await api.connection
        .collection('schedules')
        .findOne({ _id: new Types.ObjectId(otherAllowed) });
      if (automatic?.status === 'completado') break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.equal(automatic?.status, 'completado');
    const automaticHistory = await request(
      `schedules/${otherAllowed}/team-history`,
      'GET',
    );
    const automaticEntries = (
      (await automaticHistory.json()) as {
        data: Array<{ action: string; actorId: string | null }>;
      }
    ).data;
    assert.equal(automaticEntries.at(-1)?.action, 'completado');
    assert.equal(automaticEntries.at(-1)?.actorId, null);
    assert.ok(
      await api.connection
        .collection('alert_outbox')
        .findOne({ dedupeKey: `activity-completed:${otherAllowed}` }),
    );
    const deliveryDeadline = Date.now() + 25000;
    let delivered;
    while (Date.now() < deliveryDeadline) {
      delivered = await api.connection.collection('alerts').findOne({
        dedupeKey: `activity-completed:${otherAllowed}`,
      });
      if (delivered) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(delivered);
    assert.equal(delivered.recipientId.toString(), ownerId);
    assert.equal(
      (
        await request(`profiles/${profile.data.id}`, 'PATCH', {
          permissionKeys: ['cronogramas.ver', 'eventos.ver', 'alertas.ver'],
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api.request(`schedules/${noAlertsActivity}/team`, {
          method: 'POST',
          session: memberSession,
          body: { teamId: team.data.id },
        })
      ).status,
      201,
    );
    assert.equal(
      (await request(`schedules/${noAlertsActivity}/complete`, 'POST')).status,
      201,
    );
    assert.equal(
      (
        await request(`profiles/${profile.data.id}`, 'PATCH', {
          permissionKeys: ['cronogramas.ver'],
        })
      ).status,
      200,
    );
    const key = `activity-completed:${noAlertsActivity}`;
    const retryDeadline = Date.now() + 25000;
    let pending;
    while (Date.now() < retryDeadline) {
      pending = await api.connection
        .collection('alert_outbox')
        .findOne({ dedupeKey: key });
      if (pending?.nextAttemptAt?.getTime() > Date.now() + 10000) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(pending?.nextAttemptAt?.getTime() > Date.now() + 10000);
    assert.equal(pending?.deliveredAt, null);
    assert.equal(
      await api.connection
        .collection('alerts')
        .countDocuments({ dedupeKey: key }),
      0,
    );
    assert.equal(
      (
        await request(`profiles/${profile.data.id}`, 'PATCH', {
          permissionKeys: ['cronogramas.ver', 'eventos.ver', 'alertas.ver'],
        })
      ).status,
      200,
    );
    await api.connection
      .collection('alert_outbox')
      .updateOne({ dedupeKey: key }, { $set: { nextAttemptAt: new Date(0) } });
    const restoredDeadline = Date.now() + 25000;
    let restored;
    while (Date.now() < restoredDeadline) {
      restored = await api.connection
        .collection('alerts')
        .findOne({ dedupeKey: key });
      if (restored) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(restored);
    assert.equal(restored.recipientId.toString(), memberId);
    const unassignedOutside = await activity(
      eventA,
      'Actividad que quedaría fuera',
      550,
      570,
    );
    assert.equal(
      (
        await request(`events/${eventA}`, 'PATCH', {
          endAt: new Date(start.getTime() + 540 * 60000).toISOString(),
        })
      ).status,
      200,
    );
    assert.equal((await assign(unassignedOutside)).status, 409);
    await api.connection
      .collection('schedules')
      .updateOne(
        { _id: new Types.ObjectId(fallbackActivity) },
        { $set: { endAt: new Date(Date.now() - 1000) } },
      );
    assert.equal(
      (await request(`teams/${memberTeam.data.id}`, 'DELETE')).status,
      200,
    );
    assert.equal((await request(`users/${memberId}`, 'DELETE')).status, 409);
    await api.connection
      .collection('schedules')
      .updateOne(
        { _id: new Types.ObjectId(noAlertsActivity) },
        { $set: { endAt: new Date(Date.now() - 1000) } },
      );
    assert.equal((await request(`users/${memberId}`, 'DELETE')).status, 200);
  } finally {
    await api.close();
  }
});
