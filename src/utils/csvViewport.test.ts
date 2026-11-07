import assert from 'node:assert/strict';
import test from 'node:test';
import { getCsvRowSegments } from './csvViewport.ts';

function renderedRows(segments: ReturnType<typeof getCsvRowSegments>) {
  return segments.flatMap(s => s.kind === 'rows' ? Array.from({length:s.end-s.start}, (_, i) => s.start+i) : []);
}

test('large tables render a bounded window while preserving total scroll height', () => {
  for (const top of [0, 2000, 9000, 1000000]) {
    const segments = getCsvRowSegments(459, top, 554, 41);
    const rows = renderedRows(segments);
    assert.ok(rows.length <= 33);
    assert.equal(rows[0], 0);
    assert.equal(new Set(rows).size, rows.length);
    assert.equal(segments.reduce((sum, s) => sum + (s.kind === 'spacer' ? s.height : (s.end-s.start)*41), 0), 459*41);
    let cursor = 0;
    for (const segment of segments) {
      assert.equal(segment.start, cursor);
      assert.ok(segment.end > segment.start);
      cursor = segment.end;
    }
    assert.equal(cursor, 459);
  }
});

test('focused editors and adjacent keyboard targets remain mounted outside the viewport', () => {
  const rows = renderedRows(getCsvRowSegments(10000, 200000, 600, 40, 20));
  for (const row of [0,19,20,21,5000,5014]) assert.ok(rows.includes(row));
  assert.ok(rows.length < 40);
});

test('empty, short, resized, and shrunken tables keep valid ranges', () => {
  assert.deepEqual(getCsvRowSegments(0, 0, 600, 40), []);
  assert.deepEqual(renderedRows(getCsvRowSegments(1, 9999, 600, 40, 458)), [0]);
  const small = renderedRows(getCsvRowSegments(459, 5000, 300, 40));
  const large = renderedRows(getCsvRowSegments(459, 5000, 900, 40));
  assert.ok(small.every(row => large.includes(row)));
  assert.ok(large.length > small.length);
  assert.ok(renderedRows(getCsvRowSegments(459, 99999, 600, 40)).includes(458));
});
