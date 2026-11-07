export type MindMode = 'outline' | 'mindmap';

export interface MindNode {
  id: string;
  text: string;
  children: MindNode[];
  collapsed?: boolean;
}

export interface MindDocument {
  version: 1;
  mode: MindMode;
  nodes: MindNode[];
}

const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const createMindNode = (text = ''): MindNode => ({ id: newId(), text, children: [] });
export const createEmptyMindDocument = (): MindDocument => ({ version: 1, mode: 'outline', nodes: [] });

function normalizeNodes(value: unknown, seen: Set<string>, depth = 0): MindNode[] {
  if (!Array.isArray(value) || depth > 40) return [];
  return value.flatMap((entry): MindNode[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    let id = typeof item.id === 'string' && item.id ? item.id : newId();
    if (seen.has(id)) id = newId();
    seen.add(id);
    return [{ id, text: typeof item.text === 'string' ? item.text : '', collapsed: item.collapsed === true, children: normalizeNodes(item.children, seen, depth + 1) }];
  });
}

export function parseMindDocument(raw: string): MindDocument {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return createEmptyMindDocument();
    const data = value as Record<string, unknown>;
    return { version: 1, mode: data.mode === 'mindmap' ? 'mindmap' : 'outline', nodes: normalizeNodes(data.nodes, new Set()) };
  } catch { return createEmptyMindDocument(); }
}

export const serializeMindDocument = (doc: MindDocument): string => `${JSON.stringify(doc, null, 2)}\n`;

export function exportMindDocumentMarkdown(title: string, doc: MindDocument): string {
  const label = (value: string) => value.trim().replace(/\s*\n\s*/g, ' ');
  const lines = [`# ${label(title)}`];
  const addChildren = (nodes: MindNode[], depth: number) => {
    for (const node of nodes) {
      lines.push(`${'  '.repeat(depth)}- ${label(node.text)}`);
      addChildren(node.children, depth + 1);
    }
  };
  for (const node of doc.nodes) {
    lines.push('', `## ${label(node.text)}`);
    addChildren(node.children, 0);
  }
  return `${lines.join('\n')}\n`;
}

export function mapMindNodes(nodes: MindNode[], id: string, patch: (node: MindNode) => MindNode): MindNode[] {
  return nodes.map((node) => node.id === id ? patch(node) : { ...node, children: mapMindNodes(node.children, id, patch) });
}

export function insertMindNode(nodes: MindNode[], targetId: string | null, placement: 'child' | 'after', item: MindNode): MindNode[] {
  if (targetId == null) return [...nodes, item];
  return nodes.flatMap((node) => node.id === targetId
    ? placement === 'after' ? [node, item] : [{ ...node, collapsed: false, children: [...node.children, item] }]
    : [{ ...node, children: insertMindNode(node.children, targetId, placement, item) }]);
}

export function deleteMindNode(nodes: MindNode[], id: string): MindNode[] {
  return nodes.filter((node) => node.id !== id).map((node) => ({ ...node, children: deleteMindNode(node.children, id) }));
}

export function moveMindNode(nodes: MindNode[], id: string, direction: -1 | 1): MindNode[] {
  const index = nodes.findIndex((node) => node.id === id);
  if (index >= 0) {
    const next = [...nodes];
    const target = index + direction;
    if (target >= 0 && target < next.length) [next[index], next[target]] = [next[target], next[index]];
    return next;
  }
  return nodes.map((node) => ({ ...node, children: moveMindNode(node.children, id, direction) }));
}

export function findMindNode(nodes: MindNode[], id: string): MindNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findMindNode(node.children, id);
    if (child) return child;
  }
  return undefined;
}

/** Follow the visible outline order, skipping descendants of collapsed nodes. */
export function adjacentVisibleMindNode(nodes: MindNode[], id: string, direction: -1 | 1): MindNode | null {
  const visible: MindNode[] = [];
  const visit = (items: MindNode[]) => {
    for (const node of items) {
      visible.push(node);
      if (!node.collapsed) visit(node.children);
    }
  };
  visit(nodes);
  const index = visible.findIndex((node) => node.id === id);
  return index < 0 ? null : visible[index + direction] ?? null;
}

export function isMindBranchFullyExpanded(node: MindNode): boolean {
  return !node.collapsed && node.children.every(isMindBranchFullyExpanded);
}

export function setMindBranchCollapsed(nodes: MindNode[], id: string, collapsed: boolean): MindNode[] {
  const setBranch = (node: MindNode): MindNode => ({ ...node, collapsed, children: node.children.map(setBranch) });
  return nodes.map((node) => node.id === id
    ? setBranch(node)
    : { ...node, children: setMindBranchCollapsed(node.children, id, collapsed) });
}

/** Move a whole branch to the end of another topic, or to the root level. */
export function moveMindNodeToParent(nodes: MindNode[], id: string, parentId: string | null): MindNode[] {
  const moving = findMindNode(nodes, id);
  if (!moving || parentId === id) return nodes;
  if (parentId && (!findMindNode(nodes, parentId) || findMindNode(moving.children, parentId))) return nodes;
  const without = deleteMindNode(nodes, id);
  return parentId ? insertMindNode(without, parentId, 'child', moving) : [...without, moving];
}

/** Make a node the last child of its preceding sibling. */
export function indentMindNode(nodes: MindNode[], id: string): MindNode[] {
  const index = nodes.findIndex((node) => node.id === id);
  if (index >= 0) {
    if (index === 0) return nodes;
    const next = [...nodes];
    const [moving] = next.splice(index, 1);
    const previous = next[index - 1];
    next[index - 1] = { ...previous, collapsed: false, children: [...previous.children, moving] };
    return next;
  }
  return nodes.map((node) => ({ ...node, children: indentMindNode(node.children, id) }));
}

/** Place a node immediately after its parent, retaining its descendants. */
export function outdentMindNode(nodes: MindNode[], id: string): MindNode[] {
  for (let index = 0; index < nodes.length; index++) {
    const parent = nodes[index];
    const childIndex = parent.children.findIndex((child) => child.id === id);
    if (childIndex >= 0) {
      const next = [...nodes];
      const children = [...parent.children];
      const [moving] = children.splice(childIndex, 1);
      next.splice(index, 1, { ...parent, children }, moving);
      return next;
    }
  }
  return nodes.map((node) => ({ ...node, children: outdentMindNode(node.children, id) }));
}

/** Insert an empty parent in the current position and keep the original branch beneath it. */
export function wrapMindNodeWithParent(nodes: MindNode[], id: string, parent: MindNode): MindNode[] {
  const index = nodes.findIndex((node) => node.id === id);
  if (index >= 0) {
    const next = [...nodes];
    next[index] = { ...parent, children: [next[index]] };
    return next;
  }
  return nodes.map((node) => ({ ...node, children: wrapMindNodeWithParent(node.children, id, parent) }));
}
