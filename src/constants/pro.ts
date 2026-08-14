import type { NotebookFormatId } from '@/utils/notebookFormat';

/** Free tier: max number of spaces. */
export const FREE_MAX_SPACES = 5;

/** Free tier: max notebooks inside a single space. */
export const FREE_MAX_NOTEBOOKS_PER_SPACE = 100;

/** Offline grace period after a successful online validation (days). */
export const LICENSE_OFFLINE_GRACE_DAYS = 14;

export type ProFeature =
  | 'spaceLimit'
  | 'notebookLimit'
  | 'articleNotebook'
  | 'sync';

/** Article notebooks (markdown / writer) require Pro to create. */
export function isArticleNotebookFormat(format: NotebookFormatId): boolean {
  return format === 'markdown' || format === 'writer';
}
