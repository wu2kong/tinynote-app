import assert from 'node:assert/strict';
import test from 'node:test';

import { forcedUpdateSource, updateSourceOrder } from '../../scripts/lib/update-sources.mjs';

test('app update helper tries GitHub first and Qiniu on fallback', () => {
  assert.deepEqual(updateSourceOrder('github', 'qiniu', 'auto')[0], 'github');
  assert.deepEqual(updateSourceOrder('github', 'qiniu', 'qiniu')[0], 'qiniu');
  assert.equal(forcedUpdateSource({ TINYNOTE_UPDATE_SOURCE: 'qiniu' }), 'qiniu');
});
