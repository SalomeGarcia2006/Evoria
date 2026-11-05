/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  crossedThreshold,
  isBudgetNearLimit,
  isInventoryLow,
} from './thresholds';

test('presupuestos sin iniciar o en cero no generan porcentaje', () => {
  assert.equal(isBudgetNearLimit(null, 0, 80), false);
  assert.equal(isBudgetNearLimit(0, 0, 80), false);
  assert.equal(isBudgetNearLimit(100, 79, 80), false);
  assert.equal(isBudgetNearLimit(100, 80, 80), true);
});

test('inventario bajo se detecta al cruzar y puede avisar tras recuperarse', () => {
  const states = [50, 20, 10, 30, 20].map((available) =>
    isInventoryLow(100, available, 20),
  );
  const crossings = states.map((state, index) =>
    crossedThreshold(index === 0 ? false : states[index - 1], state),
  );
  assert.deepEqual(crossings, [false, true, false, false, true]);
  assert.equal(isInventoryLow(0, 0, 20), false);
});
