import assert from 'node:assert/strict';
import test from 'node:test';
import { parseClipboardTable, pasteTableAt } from './clipboardTable.ts';
import { parseCsv, serializeCsv } from './csvTable.ts';

test('pastes Excel/WPS TSV with CRLF, empty cells and trailing row separator', () => {
  assert.deepEqual(parseClipboardTable('名称\t网址\t状态\r\nSteam\thttps://store.steampowered.com\t正常\r\nEpic\t\t正常\r\n'), [
    ['名称', '网址', '状态'],
    ['Steam', 'https://store.steampowered.com', '正常'],
    ['Epic', '', '正常'],
  ]);
});

test('preserves quoted newlines, tabs, literal quotes and commas in spreadsheet cells', () => {
  const pasted = parseClipboardTable('"line1\nline2"\t"say ""hi"""\t"a\tb"\n12" screen\thello, world\t');
  assert.deepEqual(pasted, [['line1\nline2', 'say "hi"', 'a\tb'], ['12" screen', 'hello, world', '']]);
  assert.deepEqual(parseCsv(serializeCsv(pasted!)), pasted);
});

test('recognizes the supplied WPS Markdown example and omits its separator row', () => {
  const pasted = parseClipboardTable(`| 大类 | 分组 | Tier | 名称 | 网址 | 说明 | 状态 |
| -- | ----- | ---- | -- | -- | -- | -- |
| 游戏 | 平台/商店 | A | Steam | [https://store.steampowered.com](https://store.steampowered.com) | 全球最大 PC 游戏发行平台。 | 正常 |
| 游戏 | 平台/商店 | A | Epic Games Store | https://store.epicgames.com | 每周免费游戏 | 正常 |
| 游戏 | 平台/商店 | A | GOG.com | https://www.gog.com | DRM-Free | 正常 |
| 游戏 | 平台/商店 | B | itch.io | https://itch.io | 独立游戏 | 正常 |`);
  assert.equal(pasted?.length, 5);
  assert.equal(pasted?.[0].length, 7);
  assert.equal(pasted?.[1][3], 'Steam');
  assert.equal(pasted?.[4][3], 'itch.io');
});

test('single column spreadsheet data expands rows, single row data expands columns', () => {
  assert.deepEqual(parseClipboardTable('one\ntwo\n'), [['one'], ['two']]);
  assert.deepEqual(parseClipboardTable('one\ttwo\t'), [['one', 'two', '']]);
});

test('ordinary text, URLs and comma-containing prose retain native paste', () => {
  for (const text of ['', 'hello, world', 'https://example.com', 'a | b']) {
    assert.equal(parseClipboardTable(text), null);
  }
});

test('paste expands from destination, preserves surrounding cells and does not mutate source', () => {
  const grid = [['a', 'b', 'c'], ['d', 'e', 'f']];
  const next = pasteTableAt(grid, [['1', '2', '3'], ['4', '', '6']], 1, 1);
  assert.deepEqual(next, [['a', 'b', 'c', ''], ['d', '1', '2', '3'], ['', '4', '', '6']]);
  assert.deepEqual(grid, [['a', 'b', 'c'], ['d', 'e', 'f']]);
  assert.deepEqual(parseCsv(serializeCsv(next)), next);
});
