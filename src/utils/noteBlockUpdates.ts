import type { NoteBlock } from '../types/index.ts';

/** Reconcile parser-generated IDs while preserving the latest saved sibling notes. */
export function mergeNoteBlockUpdate(
  saved: NoteBlock[],
  known: NoteBlock[],
  id: string,
  updates: Partial<NoteBlock>,
): NoteBlock[] | null {
  const target = known.find((block) => block.id === id);
  if (!target) return null;
  const index = known.indexOf(target);
  const targetIndex = saved[index]?.createdAt === target.createdAt
    ? index
    : saved.findIndex((block) => block.createdAt === target.createdAt);
  if (targetIndex < 0) return null;
  return saved.map((block, position) => {
    const previous = known[position]?.createdAt === block.createdAt
      ? known[position]
      : known.find((item) => item.createdAt === block.createdAt);
    return position === targetIndex
      ? { ...block, ...updates, id, updatedAt: new Date().toISOString() }
      : { ...block, id: previous?.id ?? block.id };
  });
}
