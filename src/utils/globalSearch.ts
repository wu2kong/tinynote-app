import { Space, Group, Notebook } from '@/types';

export interface SearchFilters {
  spaceName: boolean;
  notebookName: boolean;
  blockTitle: boolean;
  blockContent: boolean;
}

export type GlobalSearchResultType = 'space' | 'notebook' | 'noteBlock';

export interface GlobalSearchResult {
  id: string;
  type: GlobalSearchResultType;
  matchLabels: string[];
  spaceName: string;
  notebookName?: string;
  blockTitle?: string;
  spacePath: string;
  notebookPath?: string;
  blockTitleKey?: string;
}

export interface TextSegment {
  text: string;
  highlight: boolean;
}

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  spaceName: false,
  notebookName: true,
  blockTitle: true,
  blockContent: false,
};

export const FILTER_OPTIONS: { key: keyof SearchFilters; label: string }[] = [
  { key: 'spaceName', label: '空间名' },
  { key: 'notebookName', label: '笔记本名' },
  { key: 'blockTitle', label: '笔记块标题' },
  { key: 'blockContent', label: '笔记块内容' },
];

const MATCH_LABELS = {
  spaceName: '空间名',
  notebookName: '笔记本名',
  blockTitle: '笔记块标题',
  blockContent: '笔记块内容',
} as const;

function isGroup(item: Group | Notebook): item is Group {
  return 'children' in item;
}

function walkNotebooks(
  items: (Group | Notebook)[],
  callback: (notebook: Notebook) => boolean,
): boolean {
  for (const item of items) {
    if (isGroup(item)) {
      if (walkNotebooks(item.children, callback)) return true;
    } else if (callback(item)) {
      return true;
    }
  }
  return false;
}

export function splitHighlightSegments(text: string, query: string): TextSegment[] {
  const q = query.trim();
  if (!q) return [{ text, highlight: false }];

  const lowerText = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let index = lowerText.indexOf(lowerQ, lastIndex);

  while (index !== -1) {
    if (index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, index), highlight: false });
    }
    segments.push({ text: text.slice(index, index + q.length), highlight: true });
    lastIndex = index + q.length;
    index = lowerText.indexOf(lowerQ, lastIndex);
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), highlight: false });
  }

  return segments.length > 0 ? segments : [{ text, highlight: false }];
}

export function getResultTitleParts(result: GlobalSearchResult): string[] {
  const parts = [result.spaceName];
  if (result.notebookName) parts.push(result.notebookName);
  if (result.blockTitle) parts.push(result.blockTitle);
  return parts;
}

export function performGlobalSearch(
  spaces: Space[],
  query: string,
  filters: SearchFilters,
  maxResults = 50,
): GlobalSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: GlobalSearchResult[] = [];

  for (const space of spaces) {
    if (filters.spaceName && space.name.toLowerCase().includes(q)) {
      results.push({
        id: `space:${space.path}`,
        type: 'space',
        matchLabels: [MATCH_LABELS.spaceName],
        spaceName: space.name,
        spacePath: space.path,
      });
      if (results.length >= maxResults) return results;
    }

    walkNotebooks(space.groups, (notebook) => {
      if (filters.notebookName && notebook.name.toLowerCase().includes(q)) {
        results.push({
          id: `notebook:${notebook.path}`,
          type: 'notebook',
          matchLabels: [MATCH_LABELS.notebookName],
          spaceName: space.name,
          notebookName: notebook.name,
          spacePath: space.path,
          notebookPath: notebook.path,
        });
        if (results.length >= maxResults) return true;
      }

      for (const block of notebook.noteBlocks) {
        const matchLabels: string[] = [];
        if (filters.blockTitle && block.title.toLowerCase().includes(q)) {
          matchLabels.push(MATCH_LABELS.blockTitle);
        }
        if (filters.blockContent && block.content.toLowerCase().includes(q)) {
          matchLabels.push(MATCH_LABELS.blockContent);
        }
        if (matchLabels.length > 0) {
          results.push({
            id: `block:${notebook.path}:${block.title}`,
            type: 'noteBlock',
            matchLabels,
            spaceName: space.name,
            notebookName: notebook.name,
            blockTitle: block.title,
            spacePath: space.path,
            notebookPath: notebook.path,
            blockTitleKey: block.title,
          });
          if (results.length >= maxResults) return true;
        }
      }
      return false;
    });

    if (results.length >= maxResults) return results;
  }

  return results;
}
