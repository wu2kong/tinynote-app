import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyMindDocument, createMindNode, deleteMindNode, exportMindDocumentMarkdown, indentMindNode, insertMindNode, isMindBranchFullyExpanded, mapMindNodes, moveMindNode, moveMindNodeToParent, outdentMindNode, parseMindDocument, serializeMindDocument, setMindBranchCollapsed, wrapMindNodeWithParent } from './mindDocument.ts';

test('new mind notes open in outline mode and persist both views', () => {
  const doc = createEmptyMindDocument();
  assert.equal(doc.mode, 'outline');
  doc.mode = 'mindmap';
  assert.deepEqual(parseMindDocument(serializeMindDocument(doc)), doc);
  assert.equal(parseMindDocument('{"mode":"unknown"}').mode, 'outline');
});

test('tree editing retains hierarchy, order, and collapsed state', () => {
  const root = createMindNode('Root');
  const child = createMindNode('Child');
  const sibling = createMindNode('Sibling');
  let nodes = insertMindNode([], null, 'after', root);
  nodes = insertMindNode(nodes, root.id, 'child', child);
  nodes = insertMindNode(nodes, child.id, 'after', sibling);
  assert.deepEqual(nodes[0].children.map((node) => node.text), ['Child', 'Sibling']);
  nodes = moveMindNode(nodes, sibling.id, -1);
  nodes = mapMindNodes(nodes, root.id, (node) => ({ ...node, collapsed: true }));
  assert.deepEqual(nodes[0].children.map((node) => node.text), ['Sibling', 'Child']);
  assert.equal(nodes[0].collapsed, true);
  assert.equal(parseMindDocument(serializeMindDocument({ version: 1, mode: 'outline', nodes })).nodes[0].children[0].text, 'Sibling');
  assert.equal(deleteMindNode(nodes, child.id)[0].children.length, 1);
});

test('malformed input and duplicate ids are normalized safely', () => {
  assert.deepEqual(parseMindDocument('not json'), createEmptyMindDocument());
  const doc = parseMindDocument('{"nodes":[{"id":"same","text":"One","children":[{"id":"same","text":"Two"}]}]}');
  assert.notEqual(doc.nodes[0].id, doc.nodes[0].children[0].id);
});

test('moving across levels preserves the entire branch and rejects cycles', () => {
  const grandchild = { id: 'grandchild', text: 'Grandchild', children: [] };
  const child = { id: 'child', text: 'Child', children: [grandchild] };
  const nodes = [
    { id: 'first', text: 'First', children: [child] },
    { id: 'second', text: 'Second', children: [], collapsed: true },
  ];
  const moved = moveMindNodeToParent(nodes, 'child', 'second');
  assert.deepEqual(moved[0].children, []);
  assert.deepEqual(moved[1].children, [child]);
  assert.equal(moved[1].collapsed, false);
  const root = moveMindNodeToParent(moved, 'child', null);
  assert.deepEqual(root.map((node) => node.id), ['first', 'second', 'child']);
  assert.deepEqual(root[2].children, [grandchild]);
  assert.equal(moveMindNodeToParent(root, 'child', 'grandchild'), root);
  assert.equal(moveMindNodeToParent(root, 'child', 'child'), root);
  assert.equal(moveMindNodeToParent(root, 'child', 'missing'), root);
});

test('outline indent and outdent preserve branches and position after the parent', () => {
  const nested = { id: 'nested', text: 'Nested', children: [] };
  const current = { id: 'current', text: 'Current', children: [nested] };
  const nodes = [
    { id: 'first', text: 'First', children: [], collapsed: true },
    current,
    { id: 'last', text: 'Last', children: [] },
  ];
  const indented = indentMindNode(nodes, 'current');
  assert.deepEqual(indented.map((node) => node.id), ['first', 'last']);
  assert.deepEqual(indented[0].children, [current]);
  assert.equal(indented[0].collapsed, false);
  const outdented = outdentMindNode(indented, 'current');
  assert.deepEqual(outdented.map((node) => node.id), ['first', 'current', 'last']);
  assert.deepEqual(outdented[1].children, [nested]);
  assert.deepEqual(indentMindNode(nodes, 'first'), nodes);
});

test('mind map parent insertion wraps the current branch in place', () => {
  const child = { id: 'child', text: 'Child', children: [] };
  const current = { id: 'current', text: 'Current', children: [child] };
  const nodes = [{ id: 'before', text: 'Before', children: [] }, current];
  const parent = { id: 'parent', text: '', children: [] };
  const wrapped = wrapMindNodeWithParent(nodes, 'current', parent);
  assert.deepEqual(wrapped.map((node) => node.id), ['before', 'parent']);
  assert.deepEqual(wrapped[1].children, [current]);
  assert.deepEqual(wrapped[1].children[0].children, [child]);
});

test('expand and collapse all descendants toggles the whole branch', () => {
  const nodes = [{ id: 'root', text: 'Root', collapsed: true, children: [
    { id: 'child', text: 'Child', collapsed: true, children: [
      { id: 'grandchild', text: 'Grandchild', children: [] },
    ] },
  ] }, { id: 'other', text: 'Other', children: [] }];
  assert.equal(isMindBranchFullyExpanded(nodes[0]), false);
  const expanded = setMindBranchCollapsed(nodes, 'root', false);
  assert.equal(isMindBranchFullyExpanded(expanded[0]), true);
  assert.equal(expanded[0].children[0].collapsed, false);
  assert.deepEqual(expanded[1], nodes[1]);
  const collapsed = setMindBranchCollapsed(expanded, 'root', true);
  assert.equal(collapsed[0].collapsed, true);
  assert.equal(collapsed[0].children[0].collapsed, true);
});

test('Markdown export uses note title, root headings, and nested bullets including collapsed nodes', () => {
  const doc = { version: 1 as const, mode: 'mindmap' as const, nodes: [
    { id: 'a', text: 'First', collapsed: true, children: [
      { id: 'b', text: 'Child', children: [
        { id: 'c', text: 'Grandchild', children: [] },
      ] },
    ] },
    { id: 'd', text: 'Second', children: [] },
  ] };
  assert.equal(exportMindDocumentMarkdown('Ideas', doc), '# Ideas\n\n## First\n- Child\n  - Grandchild\n\n## Second\n');
});
