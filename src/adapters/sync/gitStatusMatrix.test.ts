import assert from 'node:assert/strict';
import test from 'node:test';

import { mapMatrixStatus } from './gitStatusMatrix.ts';

test('mapMatrixStatus treats clean and absent files as unchanged', () => {
  assert.equal(mapMatrixStatus(1, 1), null);
  assert.equal(mapMatrixStatus(0, 0), null);
});

test('mapMatrixStatus classifies isomorphic-git statusMatrix examples', () => {
  assert.equal(mapMatrixStatus(0, 2), 'added');
  assert.equal(mapMatrixStatus(1, 2), 'modified');
  assert.equal(mapMatrixStatus(1, 0), 'deleted');
});
