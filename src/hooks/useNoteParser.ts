import { NoteBlock } from '@/types';
import { parseNoteBlocks, serializeNoteBlocks } from '@/utils/noteParser';

export function useNoteParser() {
  const parse = (content: string): NoteBlock[] => {
    return parseNoteBlocks(content);
  };

  const serialize = (blocks: NoteBlock[]): string => {
    return serializeNoteBlocks(blocks);
  };

  return { parse, serialize };
}