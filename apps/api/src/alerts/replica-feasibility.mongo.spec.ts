/// <reference types="node" />
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';
import { createConnection, Types } from 'mongoose';

// Prueba de factibilidad aislada: todavía no conecta las transacciones a EVORIA.
test('réplica aislada: rollback de cruce y una sola decisión concurrente', async () => {
  const database = `evoria_alertas_rs_test_${new Types.ObjectId().toString()}`;
  assert.match(database, /^evoria_alertas_rs_test_[a-f0-9]{24}$/);
  const connection = await createConnection(
    `mongodb://127.0.0.1:27129/${database}?replicaSet=evoriaAlertTest`,
    { serverSelectionTimeoutMS: 5000 },
  ).asPromise();
  try {
    const inventory = connection.collection('inventory');
    const outbox = connection.collection('outbox');
    const events = connection.collection('events');
    const budgets = connection.collection('budgets');
    const itemId = new Types.ObjectId();
    const eventId = new Types.ObjectId();
    const budgetId = new Types.ObjectId();
    await inventory.insertOne({ _id: itemId, available: 10 });
    await events.insertOne({
      _id: eventId,
      status: 'active',
      owner: 'leader',
      revision: 0,
    });
    await budgets.insertOne({ _id: budgetId, status: 'pending', decisions: 0 });
    const session = await connection.startSession();
    try {
      await assert.rejects(() =>
        session.withTransaction(async () => {
          await inventory.updateOne(
            { _id: itemId },
            { $set: { available: 2 } },
            { session },
          );
          await outbox.insertOne(
            { _id: new Types.ObjectId(), itemId, event: 'low' },
            { session },
          );
          throw new Error('fallo simulado antes de confirmar');
        }),
      );
      assert.equal((await inventory.findOne({ _id: itemId }))?.available, 10);
      assert.equal(await outbox.countDocuments(), 0);
      await session.withTransaction(async () => {
        await inventory.updateOne(
          { _id: itemId },
          { $set: { available: 2 } },
          { session },
        );
        await outbox.insertOne(
          { _id: new Types.ObjectId(), itemId, event: 'low' },
          { session },
        );
      });
      await inventory.updateOne({ _id: itemId }, { $set: { available: 10 } });
      assert.equal(await outbox.countDocuments({ itemId, event: 'low' }), 1);
    } finally {
      await session.endSession();
    }
    const decide = async () => {
      const transaction = await connection.startSession();
      try {
        await transaction.withTransaction(async () => {
          const guard = await events.updateOne(
            { _id: eventId, status: 'active', owner: 'leader' },
            { $inc: { revision: 1 } },
            { session: transaction },
          );
          if (guard.modifiedCount !== 1)
            throw new Error('evento no autorizable');
          const result = await budgets.updateOne(
            { _id: budgetId, status: 'pending' },
            { $set: { status: 'approved' }, $inc: { decisions: 1 } },
            { session: transaction },
          );
          if (result.modifiedCount !== 1)
            throw new Error('solicitud ya decidida');
        });
      } finally {
        await transaction.endSession();
      }
    };
    const results = await Promise.allSettled([decide(), decide()]);
    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.equal((await budgets.findOne({ _id: budgetId }))?.decisions, 1);
    assert.equal((await events.findOne({ _id: eventId }))?.revision, 1);

    // La decisión debe escribir el evento, no solo leerlo: así una actualización
    // concurrente invalida la transacción y obliga a comprobarlo de nuevo.
    for (const change of [{ owner: 'other-leader' }, { status: 'cancelled' }]) {
      await events.updateOne(
        { _id: eventId },
        { $set: { owner: 'leader', status: 'active', revision: 0 } },
      );
      await budgets.updateOne(
        { _id: budgetId },
        { $set: { status: 'pending', decisions: 0 } },
      );
      let started!: () => void;
      let resume!: () => void;
      const snapshotRead = new Promise<void>((resolve) => (started = resolve));
      const continueDecision = new Promise<void>(
        (resolve) => (resume = resolve),
      );
      let firstAttempt = true;
      const transaction = await connection.startSession();
      const decision = transaction.withTransaction(async () => {
        await events.findOne({ _id: eventId }, { session: transaction });
        if (firstAttempt) {
          firstAttempt = false;
          started();
          await continueDecision;
        }
        const guard = await events.updateOne(
          { _id: eventId, owner: 'leader', status: 'active' },
          { $inc: { revision: 1 } },
          { session: transaction },
        );
        if (!guard.modifiedCount) throw new Error('evento no autorizable');
        await budgets.updateOne(
          { _id: budgetId, status: 'pending' },
          { $set: { status: 'approved' }, $inc: { decisions: 1 } },
          { session: transaction },
        );
      });
      try {
        await snapshotRead;
        await events.updateOne({ _id: eventId }, { $set: change });
        resume();
        await assert.rejects(decision, /evento no autorizable/);
        assert.equal((await budgets.findOne({ _id: budgetId }))?.decisions, 0);
      } finally {
        resume();
        await transaction.endSession();
      }
    }
    await events.updateOne(
      { _id: eventId },
      { $set: { owner: 'leader', status: 'active', revision: 0 } },
    );
    await budgets.updateOne(
      { _id: budgetId },
      { $set: { status: 'pending', decisions: 0 } },
    );
    const childScript = `
      const { createConnection, Types } = require('mongoose');
      (async () => {
        const db = await createConnection(process.env.TEST_URI).asPromise();
        const session = await db.startSession();
        session.startTransaction();
        await db.collection('events').updateOne(
          { _id: new Types.ObjectId(process.env.TEST_EVENT) },
          { $inc: { revision: 1 } }, { session });
        await db.collection('budgets').updateOne(
          { _id: new Types.ObjectId(process.env.TEST_BUDGET) },
          { $set: { status: 'approved' }, $inc: { decisions: 1 } }, { session });
        console.log('READY');
        setInterval(() => {}, 1000);
      })().catch((error) => { console.error(error); process.exit(1); });
    `;
    const child = spawn(process.execPath, ['-e', childScript], {
      env: {
        ...process.env,
        TEST_URI: `mongodb://127.0.0.1:27129/${database}?replicaSet=evoriaAlertTest`,
        TEST_EVENT: eventId.toString(),
        TEST_BUDGET: budgetId.toString(),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('proceso no inició')),
          15000,
        );
        child.stdout.on('data', (data: Buffer) => {
          if (data.toString().includes('READY')) {
            clearTimeout(timer);
            resolve();
          }
        });
        child.once('error', reject);
        child.once('exit', (code) => {
          clearTimeout(timer);
          if (code !== null) reject(new Error(`proceso terminó: ${code}`));
        });
      });
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = once(child, 'exit');
        child.kill();
        await exited;
      }
    }
    const afterCrash = await Promise.allSettled([decide(), decide()]);
    assert.equal(
      afterCrash.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.equal((await budgets.findOne({ _id: budgetId }))?.decisions, 1);
    assert.equal((await events.findOne({ _id: eventId }))?.revision, 1);
  } finally {
    await connection.dropDatabase();
    await connection.close();
  }
});
