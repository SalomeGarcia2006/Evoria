import { eventClientFixture } from '../testing/event-client.fixture';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Script } from 'node:vm';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { Event } from '../events/schemas/event.schema';
import { EventProviderService } from './schemas/event-provider-service.schema';
import { ProviderServiceMail } from './schemas/provider-service-mail.schema';
import { Provider } from '../providers/schemas/provider.schema';
import { Tenant } from '../tenants/schemas/tenant.schema';
import { EventBudget } from '../budgets/schemas/event-budget.schema';
import { BudgetLedgerService } from '../budgets/budget-ledger.service';
import { AuditsService } from '../audits/audits.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { Alert } from '../alerts/alert.schema';
import { Types } from 'mongoose';
import { AlertsService } from '../alerts/alerts.service';
import {
  createHttpTestApi,
  createTenantTestContext,
  type HttpSession,
} from '../testing/http-test-api';
import { ProviderServiceWorkflow } from './provider-service-workflow.service';

test('HTTP: confirmación de proveedor, presupuesto, correo y aislamiento en MongoDB real', async (t) => {
  const messages: Array<{ to: string; text: string }> = [];
  let failMail = false;
  const api = await createHttpTestApi('provider_confirmation', undefined, {
    async send(to, _subject, text) {
      if (failMail) throw new Error('SMTP temporalmente no disponible');
      messages.push({ to, text });
    },
  });
  const workflow = api.get(ProviderServiceWorkflow);
  const alerts = api.get(AlertsService);
  alerts.onModuleDestroy();
  const services = api.connection.collection('event_provider_services');
  const jobs = api.connection.collection('provider_service_mail_jobs');
  const secondWorker = () =>
    new ProviderServiceWorkflow(
      api.connection.model<EventProviderService>(EventProviderService.name),
      api.connection.model<ProviderServiceMail>(ProviderServiceMail.name),
      api.connection.model<Event>(Event.name),
      api.connection.model<Provider>(Provider.name),
      api.connection.model<EventBudget>(EventBudget.name),
      api.connection.model<Tenant>(Tenant.name),
      api.get(BudgetLedgerService),
      alerts,
      api.get(AuditsService),
      api.get(MailService),
      api.get(ConfigService),
    );
  try {
    const ctx = await createTenantTestContext(api);
    const owner = ctx.ownerSession;
    const ownerId = (owner.data as { user: { id: string } }).user.id;
    const tenantId = new Types.ObjectId(ctx.tenantId);
    async function data<T>(response: Response, expected = 201): Promise<T> {
      const body = (await response.json()) as { data: T; message: unknown };
      assert.equal(response.status, expected, JSON.stringify(body));
      return body.data;
    }
    const permissionKeys = (
      await api.connection
        .collection('permissions')
        .find({ status: 'activo', scope: 'tenant' })
        .toArray()
    ).map((p) => p.key as string);
    const profile = await data<{ id: string }>(
      await api.request('profiles', {
        method: 'POST',
        session: owner,
        body: {
          name: 'Equipo confirmaciones',
          description: 'Prueba aislada',
          permissionKeys,
        },
      }),
    );
    async function member(name: string) {
      const user = await data<{ id: string }>(
        await api.createUserFixture({
          method: 'POST',
          session: owner,
          body: {
            name,
            email: `${name}@example.test`,
            password: 'Prueba-segura1',
            profileId: profile.id,
          },
        }),
      );
      return {
        id: user.id,
        session: await api.login(`${name}@example.test`, 'Prueba-segura1'),
      };
    }
    const requester = await member('solicitante');
    const unrelated = await member('ajeno');
    const provider = await data<{ id: string }>(
      await api.request('providers', {
        method: 'POST',
        session: owner,
        body: {
          name: 'Proveedor confirmaciones',
          categoryKeys: ['espacios'],
          contactName: 'Contacto',
          email: 'provider@example.test',
        },
      }),
    );
    async function event(amount = 1000) {
      return data<{ id: string }>(
        await api.request('events', {
          method: 'POST',
          session: owner,
          body: {
            client: eventClientFixture(),
            name: 'Evento confirmaciones',
            startAt: '2030-01-10T10:00:00Z',
            endAt: '2030-01-10T18:00:00Z',
            baseBudget: amount,
            responsibleUserId: ownerId,
          },
        }),
      );
    }
    async function request(
      eventId: string,
      amount = 300,
      session: HttpSession = requester.session,
    ) {
      return data<{ id: string; status: string; emailDelivery: string }>(
        await api.request(`events/${eventId}/provider-services`, {
          method: 'POST',
          session,
          body: {
            providerId: provider.id,
            serviceName: 'Servicio confirmado por correo',
            startDate: '2020-01-01',
            agreedAmountCop: amount,
          },
        }),
      );
    }
    async function link(id: string) {
      await workflow.deliverMail();
      const message = messages.findLast((m) =>
        m.text.includes(`#id=${id}&token=`),
      );
      assert.ok(
        message,
        'Debe existir el correo real construido por el servicio',
      );
      assert.equal(message.to, 'provider@example.test');
      const url = new URL(message.text.match(/http[^\s]+/)![0]);
      const params = new URLSearchParams(url.hash.slice(1));
      return { serviceId: id, token: params.get('token')! };
    }
    async function spent(eventId: string) {
      const budget = await api.connection
        .collection('event_budgets')
        .findOne({ tenantId, eventId: new Types.ObjectId(eventId) });
      return budget?.providerSpentCop as number;
    }
    const status = async (id: string) =>
      (await services.findOne({ _id: new Types.ObjectId(id) }))
        ?.status as string;

    await t.test(
      'pendiente no descuenta; falla SMTP y se recupera; aceptar dos veces carga una vez',
      async () => {
        const ev = await event();
        const service = await request(ev.id);
        assert.equal(service.status, 'pendiente');
        assert.equal(service.emailDelivery, 'queued');
        assert.equal(await spent(ev.id), 0);
        assert.equal(
          (
            await api.request(
              `events/${ev.id}/provider-services/${service.id}`,
              {
                method: 'PATCH',
                session: requester.session,
                body: { agreedAmountCop: 600 },
              },
            )
          ).status,
          409,
        );
        const assigned = await data<unknown[]>(
          await api.request(
            `events/${ev.id}/provider-services?status=confirmado`,
            { session: owner },
          ),
          200,
        );
        assert.equal(assigned.length, 0);
        failMail = true;
        await workflow.deliverMail();
        assert.equal(
          (await services.findOne({ _id: new Types.ObjectId(service.id) }))
            ?.emailDelivery,
          'failed',
        );
        assert.equal(await spent(ev.id), 0);
        failMail = false;
        await jobs.updateMany(
          { deliveredAt: null },
          { $set: { nextAttemptAt: new Date(0), claimedUntil: new Date(0) } },
        );
        await Promise.all([workflow.deliverMail(), workflow.deliverMail()]);
        const credentials = await link(service.id);
        assert.equal(
          messages.filter((m) => m.text.includes(`#id=${service.id}&token=`))
            .length,
          1,
        );
        const page = await api.request('provider-service-confirmation');
        assert.equal(page.status, 200);
        assert.match(
          page.headers.get('content-security-policy') ?? '',
          /frame-ancestors 'none'/,
        );
        const html = await page.text();
        new Script(html.match(/<script>([\s\S]*)<\/script>/)![1]);
        assert.equal(await spent(ev.id), 0);
        assert.equal(
          (
            await api.request('provider-service-confirmation/details', {
              method: 'POST',
              body: { ...credentials, token: 'a'.repeat(64) },
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await data<{ canRespond: boolean }>(
              await api.request('provider-service-confirmation/details', {
                method: 'POST',
                body: credentials,
              }),
            )
          ).canRespond,
          true,
        );
        await alerts.retryPending();
        const pendingAlerts = await data<{
          items: Array<{
            id: string;
            serviceStatus: string;
            providerServiceId: string;
          }>;
        }>(
          await api.request('alerts?type=provider_service', {
            session: requester.session,
          }),
          200,
        );
        const notification = pendingAlerts.items.find(
          (a) => a.providerServiceId === service.id,
        )!;
        assert.equal(notification.serviceStatus, 'pendiente');
        assert.equal(
          (
            await api.request(`alerts/${notification.id}/read`, {
              method: 'PATCH',
              session: requester.session,
            })
          ).status,
          200,
        );
        assert.equal(await status(service.id), 'pendiente');
        const responses = await Promise.all(
          [1, 2].map(() =>
            api.request('provider-service-confirmation/respond', {
              method: 'POST',
              body: { ...credentials, decision: 'aceptar' },
            }),
          ),
        );
        assert.deepEqual(
          responses.map((r) => r.status),
          [201, 201],
        );
        assert.equal(await status(service.id), 'confirmado');
        assert.equal(await spent(ev.id), 300);
        assert.equal(
          (
            await api.request('provider-service-confirmation/respond', {
              method: 'POST',
              body: { ...credentials, decision: 'rechazar' },
            })
          ).status,
          409,
        );
        await alerts.retryPending();
        const updated = await data<{
          items: Array<{
            id: string;
            serviceStatus: string;
            readAt: string | null;
          }>;
        }>(
          await api.request('alerts?type=provider_service', {
            session: requester.session,
          }),
          200,
        );
        assert.equal(updated.items.length, 1);
        assert.equal(updated.items[0].id, notification.id);
        assert.equal(updated.items[0].serviceStatus, 'confirmado');
        assert.equal(updated.items[0].readAt, null);
        assert.equal(
          (
            await api.request(
              `events/${ev.id}/provider-services/${service.id}`,
              { method: 'DELETE', session: unrelated.session },
            )
          ).status,
          403,
        );
        for (let i = 0; i < 2; i += 1)
          assert.equal(
            (
              await api.request(
                `events/${ev.id}/provider-services/${service.id}`,
                { method: 'DELETE', session: owner },
              )
            ).status,
            200,
          );
        assert.equal(await spent(ev.id), 0);
        await workflow.deliverMail();
        assert.equal(
          messages.filter((m) => m.text.includes(`Referencia: ${service.id}.`))
            .length,
          1,
        );
      },
    );

    await t.test(
      'reintentar la creación con la misma clave no duplica la solicitud ni el correo',
      async () => {
        const ev = await event();
        const body = {
          providerId: provider.id,
          serviceName: 'Solicitud idempotente',
          startDate: '2030-01-01',
          agreedAmountCop: 100,
          idempotencyKey: randomUUID(),
        };
        const results = await Promise.all(
          [1, 2].map(async () =>
            data<{ id: string }>(
              await api.request(`events/${ev.id}/provider-services`, {
                method: 'POST',
                session: requester.session,
                body,
              }),
            ),
          ),
        );
        assert.equal(results[0].id, results[1].id);
        assert.equal(
          await jobs.countDocuments({
            serviceId: new Types.ObjectId(results[0].id),
            kind: 'request',
          }),
          1,
        );
        assert.equal(
          (
            await api.request(`events/${ev.id}/provider-services`, {
              method: 'POST',
              session: requester.session,
              body: { ...body, agreedAmountCop: 101 },
            })
          ).status,
          409,
        );
      },
    );

    await t.test(
      'un worker nuevo recupera correo abandonado y las alertas retrasadas conservan el estado más reciente',
      async () => {
        const ev = await event();
        const service = await request(ev.id);
        await jobs.updateOne(
          { serviceId: new Types.ObjectId(service.id) },
          {
            $set: {
              claimId: 'proceso_interrumpido',
              claimedUntil: new Date(0),
            },
          },
        );
        const restarted = secondWorker();
        await Promise.all([workflow.deliverMail(), restarted.deliverMail()]);
        assert.equal(
          messages.filter((m) => m.text.includes(`#id=${service.id}&token=`))
            .length,
          1,
        );
        const credentials = await link(service.id);
        const model = api.connection.model<Alert>(Alert.name);
        const original = model.updateOne;
        Object.defineProperty(model, 'updateOne', {
          configurable: true,
          writable: true,
          value: () =>
            Promise.reject(new Error('Entrega de alerta interrumpida')),
        });
        try {
          await alerts.retryPending();
          await data(
            await api.request('provider-service-confirmation/respond', {
              method: 'POST',
              body: { ...credentials, decision: 'aceptar' },
            }),
          );
          await alerts.retryPending();
        } finally {
          Object.defineProperty(model, 'updateOne', {
            configurable: true,
            writable: true,
            value: original,
          });
        }
        assert.equal(await spent(ev.id), 300);
        const outbox = api.connection.collection('alert_outbox');
        await outbox.updateMany(
          { 'payload.providerServiceId': service.id },
          { $set: { nextAttemptAt: new Date(0) } },
        );
        await outbox.updateOne(
          {
            'payload.providerServiceId': service.id,
            'payload.serviceRevision': 1,
          },
          { $set: { nextAttemptAt: new Date(Date.now() + 60000) } },
        );
        await alerts.retryPending();
        const delivered = await api.connection
          .collection('alerts')
          .findOne({ providerServiceId: new Types.ObjectId(service.id) });
        assert.equal(delivered?.serviceStatus, 'confirmado');
        assert.equal(
          (
            await api.request(`alerts/${delivered!._id.toString()}/read`, {
              method: 'PATCH',
              session: requester.session,
            })
          ).status,
          200,
        );
        await outbox.updateOne(
          {
            'payload.providerServiceId': service.id,
            'payload.serviceRevision': 1,
          },
          { $set: { nextAttemptAt: new Date(0) } },
        );
        await alerts.retryPending();
        const after = await api.connection
          .collection('alerts')
          .findOne({ _id: delivered!._id });
        assert.equal(after?.serviceStatus, 'confirmado');
        assert.ok(
          after?.readAt,
          'Una entrega antigua no debe volver a marcar como no leída la alerta actual',
        );
        assert.equal(
          await api.connection.collection('alerts').countDocuments({
            providerServiceId: new Types.ObjectId(service.id),
          }),
          1,
        );
      },
    );

    await t.test(
      'sin saldo espera y se asigna tras una ampliación aprobada con la lógica existente',
      async () => {
        const ev = await event(100);
        const service = await request(ev.id, 500);
        const credentials = await link(service.id);
        const accepted = await data<{
          status: string;
          fundingExpiresAt: string;
        }>(
          await api.request('provider-service-confirmation/respond', {
            method: 'POST',
            body: { ...credentials, decision: 'aceptar' },
          }),
        );
        assert.equal(accepted.status, 'aceptado_sin_saldo');
        assert.ok(accepted.fundingExpiresAt);
        assert.equal(await spent(ev.id), 0);
        const budgetRequest = await data<{ id: string }>(
          await api.request(`events/${ev.id}/budget/requests`, {
            method: 'POST',
            session: requester.session,
            body: {
              type: 'ampliacion',
              amountCop: 500,
              reason: 'Saldo para servicio aceptado por proveedor',
            },
          }),
        );
        assert.equal(
          (
            await api.request(
              `events/${ev.id}/budget/requests/${budgetRequest.id}/approve`,
              { method: 'POST', session: owner },
            )
          ).status,
          201,
        );
        assert.equal(
          await status(service.id),
          'confirmado',
          'La ampliación debe confirmar dentro de su propia transacción, sin esperar al worker',
        );
        await services.updateOne(
          { _id: new Types.ObjectId(service.id) },
          { $set: { nextCheckAt: new Date(0) } },
        );
        await workflow.tick();
        assert.equal(await status(service.id), 'confirmado');
        assert.equal(await spent(ev.id), 500);
        await Promise.all([
          workflow.reconcileOne(service.id),
          workflow.reconcileOne(service.id),
        ]);
        assert.equal(await spent(ev.id), 500);
      },
    );

    await t.test(
      'rechazo, vencimiento de respuesta y vencimiento sin saldo nunca cargan gasto',
      async () => {
        const ev = await event(100);
        const rejected = await request(ev.id, 500);
        const token = await link(rejected.id);
        await data(
          await api.request('provider-service-confirmation/respond', {
            method: 'POST',
            body: {
              ...token,
              decision: 'rechazar',
              reason: 'No tengo disponibilidad',
            },
          }),
        );
        assert.equal(await status(rejected.id), 'rechazado');
        await alerts.retryPending();
        const rejectionAlert = await api.connection
          .collection('alerts')
          .findOne({
            providerServiceId: new Types.ObjectId(rejected.id),
            recipientId: new Types.ObjectId(requester.id),
          });
        assert.match(rejectionAlert?.title as string, /no aceptó/);
        const expired = await request(ev.id, 500);
        const expiredToken = await link(expired.id);
        await services.updateOne(
          { _id: new Types.ObjectId(expired.id) },
          { $set: { responseExpiresAt: new Date(0) } },
        );
        assert.equal(
          (
            await api.request('provider-service-confirmation/respond', {
              method: 'POST',
              body: { ...expiredToken, decision: 'aceptar' },
            })
          ).status,
          409,
        );
        await workflow.reconcileOne(expired.id);
        assert.equal(await status(expired.id), 'vencido');
        const unfunded = await request(ev.id, 500);
        const unfundedToken = await link(unfunded.id);
        await data(
          await api.request('provider-service-confirmation/respond', {
            method: 'POST',
            body: { ...unfundedToken, decision: 'aceptar' },
          }),
        );
        await services.updateOne(
          { _id: new Types.ObjectId(unfunded.id) },
          { $set: { fundingExpiresAt: new Date(0) } },
        );
        const lateFunding = await data<{ id: string }>(
          await api.request(`events/${ev.id}/budget/requests`, {
            method: 'POST',
            session: requester.session,
            body: {
              type: 'ampliacion',
              amountCop: 500,
              reason: 'Ampliación posterior al vencimiento del servicio',
            },
          }),
        );
        assert.equal(
          (
            await api.request(
              `events/${ev.id}/budget/requests/${lateFunding.id}/approve`,
              { method: 'POST', session: owner },
            )
          ).status,
          201,
        );
        assert.equal(await spent(ev.id), 0);
        await workflow.reconcileOne(unfunded.id);
        assert.equal(await status(unfunded.id), 'cancelado');
        assert.equal(await spent(ev.id), 0);
        const active = await data<Array<{ id: string }>>(
          await api.request(`events/${ev.id}/provider-services`, {
            session: owner,
          }),
          200,
        );
        assert.equal(active.length, 0);
      },
    );

    await t.test(
      'la devolución de inventario confirma dentro de la misma transacción a quien esperaba saldo',
      async () => {
        const ev = await event(500);
        const item = await data<{ id: string }>(
          await api.request('inventory', {
            method: 'POST',
            session: owner,
            body: {
              name: 'Recurso que libera saldo',
              type: 'Mobiliario',
              unitCost: 100,
              totalQuantity: 10,
            },
          }),
        );
        await data(
          await api.request(`events/${ev.id}/resources`, {
            method: 'POST',
            session: owner,
            body: { inventoryItemId: item.id, quantity: 4 },
          }),
        );
        const service = await request(ev.id, 300);
        const credentials = await link(service.id);
        await data(
          await api.request('provider-service-confirmation/respond', {
            method: 'POST',
            body: { ...credentials, decision: 'aceptar' },
          }),
        );
        assert.equal(await status(service.id), 'aceptado_sin_saldo');
        assert.equal(
          (
            await api.request(`events/${ev.id}/resources/${item.id}`, {
              method: 'DELETE',
              session: owner,
            })
          ).status,
          200,
        );
        assert.equal(await status(service.id), 'confirmado');
        assert.equal(await spent(ev.id), 300);
        assert.equal(
          (
            await api.request(`events/${ev.id}/resources`, {
              method: 'POST',
              session: owner,
              body: { inventoryItemId: item.id, quantity: 3 },
            })
          ).status,
          409,
        );
        assert.equal(await spent(ev.id), 300);
      },
    );

    await t.test(
      'sin correo válido o configuración segura no se crea una solicitud',
      async () => {
        const ev = await event();
        const phoneOnly = await data<{ id: string }>(
          await api.request('providers', {
            method: 'POST',
            session: owner,
            body: {
              name: 'Solo teléfono',
              categoryKeys: ['espacios'],
              phone: '3001234567',
            },
          }),
        );
        const payload = {
          providerId: phoneOnly.id,
          serviceName: 'Servicio sin correo',
          startDate: '2030-01-01',
          agreedAmountCop: 100,
        };
        assert.equal(
          (
            await api.request(`events/${ev.id}/provider-services`, {
              method: 'POST',
              session: owner,
              body: payload,
            })
          ).status,
          400,
        );
        const secret = process.env.PROVIDER_CONFIRMATION_SECRET;
        try {
          process.env.PROVIDER_CONFIRMATION_SECRET = 'short';
          assert.equal(
            (
              await api.request(`events/${ev.id}/provider-services`, {
                method: 'POST',
                session: owner,
                body: { ...payload, providerId: provider.id },
              })
            ).status,
            503,
          );
        } finally {
          process.env.PROVIDER_CONFIRMATION_SECRET = secret;
        }
        assert.equal(
          await services.countDocuments({ eventId: new Types.ObjectId(ev.id) }),
          0,
        );
        assert.equal(await spent(ev.id), 0);
      },
    );

    await t.test(
      'reenviar invalida el enlace anterior y solo lo permite al solicitante o líder vigente',
      async () => {
        const ev = await event();
        const service = await request(ev.id);
        const old = await link(service.id);
        await services.updateOne(
          { _id: new Types.ObjectId(service.id) },
          { $set: { responseExpiresAt: new Date(Date.now() + 23 * 3600000) } },
        );
        assert.equal(
          (
            await api.request(
              `events/${ev.id}/provider-services/${service.id}/resend`,
              { method: 'POST', session: unrelated.session },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await api.request(
              `events/${ev.id}/provider-services/${service.id}/resend`,
              { method: 'POST', session: owner },
            )
          ).status,
          201,
        );
        assert.equal(
          (
            await api.request('provider-service-confirmation/respond', {
              method: 'POST',
              body: { ...old, decision: 'aceptar' },
            })
          ).status,
          404,
        );
        const fresh = await link(service.id);
        assert.notEqual(fresh.token, old.token);
        await data(
          await api.request('provider-service-confirmation/respond', {
            method: 'POST',
            body: { ...fresh, decision: 'rechazar' },
          }),
        );
        assert.equal(await spent(ev.id), 0);
      },
    );

    await t.test(
      'cancelación de evento y decisiones opuestas concurrentes mantienen consistencia',
      async () => {
        const ev = await event();
        const service = await request(ev.id);
        const credentials = await link(service.id);
        const opposite = await Promise.all(
          ['aceptar', 'rechazar'].map((decision) =>
            api.request('provider-service-confirmation/respond', {
              method: 'POST',
              body: { ...credentials, decision },
            }),
          ),
        );
        assert.deepEqual(opposite.map((r) => r.status).sort(), [201, 409]);
        assert.equal(
          await spent(ev.id),
          (await status(service.id)) === 'confirmado' ? 300 : 0,
        );
        const other = await request(ev.id);
        const otherToken = await link(other.id);
        assert.equal(
          (
            await api.request(`events/${ev.id}`, {
              method: 'DELETE',
              session: owner,
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await api.request('provider-service-confirmation/respond', {
              method: 'POST',
              body: { ...otherToken, decision: 'aceptar' },
            })
          ).status,
          409,
        );
        await workflow.reconcileOne(other.id);
        assert.equal(await status(other.id), 'cancelado');
      },
    );

    await t.test(
      'cambio de líder y cancelación intercalados con una decisión vuelven a validar el evento',
      async () => {
        const ev = await event();
        const service = await request(ev.id);
        const credentials = await link(service.id);
        const events = api.connection.model(Event.name);
        const original = events.findOneAndUpdate;
        async function interleave(
          start: () => Promise<Response>,
          change: () => Promise<Response>,
        ) {
          let release!: () => void;
          let reached!: () => void;
          const gate = new Promise<void>((resolve) => {
            release = resolve;
          });
          const waiting = new Promise<void>((resolve) => {
            reached = resolve;
          });
          let first = true;
          Object.defineProperty(events, 'findOneAndUpdate', {
            configurable: true,
            writable: true,
            value: async (...args: unknown[]) => {
              if (first) {
                first = false;
                reached();
                await gate;
              }
              return Reflect.apply(original, events, args) as unknown;
            },
          });
          try {
            const pending = start();
            await waiting;
            assert.equal((await change()).status, 200);
            release();
            return await pending;
          } finally {
            release();
            Object.defineProperty(events, 'findOneAndUpdate', {
              configurable: true,
              writable: true,
              value: original,
            });
          }
        }
        const formerLeader = await interleave(
          () =>
            api.request(`events/${ev.id}/provider-services/${service.id}`, {
              method: 'DELETE',
              session: owner,
            }),
          () =>
            api.request(`events/${ev.id}`, {
              method: 'PATCH',
              session: owner,
              body: { responsibleUserId: unrelated.id },
            }),
        );
        assert.equal(formerLeader.status, 403);
        const canceled = await interleave(
          () =>
            api.request('provider-service-confirmation/respond', {
              method: 'POST',
              body: { ...credentials, decision: 'aceptar' },
            }),
          () =>
            api.request(`events/${ev.id}`, {
              method: 'DELETE',
              session: owner,
            }),
        );
        assert.equal(canceled.status, 409);
        assert.equal(await spent(ev.id), 0);
        await workflow.reconcileOne(service.id);
        assert.equal(await status(service.id), 'cancelado');
      },
    );

    if (process.env.EVORIA_TEST_FAILPOINTS === '1') {
      await t.test(
        'confirmación incierta e interrupción real del proceso no duplican el gasto',
        async () => {
          const uri = new URL(process.env.MONGODB_URI!);
          assert.equal(uri.hostname, '127.0.0.1');
          assert.equal(uri.port, '27129');
          assert.match(uri.pathname, /^\/evoria_provider_confirmation_/);
          const ev = await event();
          const service = await request(ev.id);
          const credentials = await link(service.id);
          const admin = api.connection.db!.admin();
          const point = await admin.command({
            configureFailPoint: 'failCommand',
            mode: { times: 1 },
            data: {
              failCommands: ['commitTransaction'],
              closeConnection: true,
            },
          });
          try {
            await data(
              await api.request('provider-service-confirmation/respond', {
                method: 'POST',
                body: { ...credentials, decision: 'aceptar' },
              }),
            );
          } finally {
            const disabled = await admin.command({
              configureFailPoint: 'failCommand',
              mode: 'off',
            });
            assert.ok(disabled.count > point.count);
          }
          assert.equal(await spent(ev.id), 300);
          const interrupted = await request(ev.id, 200);
          const interruptedToken = await link(interrupted.id);
          const before = await admin.command({
            getParameter: 1,
            transactionLifetimeLimitSeconds: 1,
          });
          await admin.command({
            setParameter: 1,
            transactionLifetimeLimitSeconds: 3,
          });
          let child: ChildProcess | undefined;
          try {
            child = spawn(
              process.execPath,
              [
                '--require',
                'ts-node/register',
                'test/interrupt-provider-decision.cjs',
              ],
              {
                cwd: process.cwd(),
                env: { ...process.env, PROVIDER_WORKER_ENABLED: 'false' },
                stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
              },
            );
            let errors = '';
            child.stderr?.on('data', (chunk: Buffer) => {
              errors += chunk.toString();
            });
            const phase = (expected: string) =>
              new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => {
                  cleanup();
                  reject(
                    new Error(`El proceso no alcanzó ${expected}: ${errors}`),
                  );
                }, 30000);
                const onMessage = (message: { phase?: string }) => {
                  if (message.phase === expected) {
                    cleanup();
                    resolve();
                  }
                };
                const onExit = () => {
                  cleanup();
                  reject(
                    new Error(
                      `El proceso terminó antes de ${expected}: ${errors}`,
                    ),
                  );
                };
                function cleanup() {
                  clearTimeout(timer);
                  child!.off('message', onMessage);
                  child!.off('exit', onExit);
                }
                child!.on('message', onMessage);
                child!.on('exit', onExit);
              });
            await phase('ready');
            const written = phase('uncommitted');
            child.send!({ id: interrupted.id, token: interruptedToken.token });
            await written;
            const exit = new Promise<void>((resolve) =>
              child!.once('exit', () => resolve()),
            );
            child.kill('SIGKILL');
            await exit;
            assert.equal(await spent(ev.id), 300);
            assert.equal(await status(interrupted.id), 'pendiente');
            await data(
              await api.request('provider-service-confirmation/respond', {
                method: 'POST',
                body: { ...interruptedToken, decision: 'aceptar' },
              }),
            );
            assert.equal(await spent(ev.id), 500);
            await data(
              await api.request('provider-service-confirmation/respond', {
                method: 'POST',
                body: { ...interruptedToken, decision: 'aceptar' },
              }),
            );
            assert.equal(await spent(ev.id), 500);
            assert.equal(
              (
                await api.connection
                  .collection('events')
                  .findOne({ _id: new Types.ObjectId(ev.id) })
              )?.budgetDecisionLock,
              undefined,
            );
          } finally {
            child?.kill('SIGKILL');
            await admin.command({
              setParameter: 1,
              transactionLifetimeLimitSeconds:
                before.transactionLifetimeLimitSeconds,
            });
          }
        },
      );
    }

    await t.test(
      'otra empresa, permisos revocados y membresía inactiva no acceden a las alertas',
      async () => {
        const otherCompany = await data<{ id: string }>(
          await api.request('tenants', {
            method: 'POST',
            session: ctx.developerSession,
            body: {
              name: 'Otra empresa',
              nit: '900123459-4',
              ownerName: 'Otro dueño',
              ownerEmail: 'other-confirmation@example.test',
              ownerPassword: 'Prueba-segura1',
            },
          }),
        );
        assert.ok(otherCompany.id);
        const otherOwner = await api.login(
          'other-confirmation@example.test',
          'Prueba-segura1',
        );
        const ev = await event();
        const service = await request(ev.id);
        await alerts.retryPending();
        const alert = await api.connection
          .collection('alerts')
          .findOne({ providerServiceId: new Types.ObjectId(service.id) });
        assert.ok(alert);
        assert.equal(
          (
            await api.request(`events/${ev.id}/provider-services`, {
              session: otherOwner,
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await api.request(`alerts/${alert._id.toString()}/read`, {
              method: 'PATCH',
              session: otherOwner,
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await api.request(`alerts/${alert._id.toString()}`, {
              session: unrelated.session,
            })
          ).status,
          404,
        );
        await api.connection
          .collection('permissions')
          .updateOne(
            { key: 'servicios_proveedor.ver' },
            { $set: { status: 'inactivo' } },
          );
        assert.equal(
          (
            await api.request(`alerts/${alert._id.toString()}`, {
              session: requester.session,
            })
          ).status,
          404,
        );
        await api.connection
          .collection('permissions')
          .updateOne(
            { key: 'servicios_proveedor.ver' },
            { $set: { status: 'activo' } },
          );
        await api.connection
          .collection('memberships')
          .updateOne(
            { tenantId, userId: new Types.ObjectId(requester.id) },
            { $set: { status: 'inactivo' } },
          );
        assert.equal(
          (
            await api.request(`alerts/${alert._id.toString()}`, {
              session: requester.session,
            })
          ).status,
          401,
        );
      },
    );
  } finally {
    await api.close();
  }
});
