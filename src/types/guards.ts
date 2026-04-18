export function isGroup(child: unknown): child is import('@/types').Group {
  return child !== null && typeof child === 'object' && 'children' in child;
}

export function isNotebook(child: unknown): child is import('@/types').Notebook {
  return child !== null && typeof child === 'object' && 'noteBlocks' in child;
}