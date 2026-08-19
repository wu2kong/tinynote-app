import type { NotebookFormatId } from '@/utils/notebookFormat';

/** Free tier: max number of spaces. */
export const FREE_MAX_SPACES = 5;

/** Free tier: max notebooks inside a single space. */
export const FREE_MAX_NOTEBOOKS_PER_SPACE = 100;

/** Free tier: max trial notebooks per article format (markdown / writer) in a single space. */
export const FREE_MAX_ARTICLE_NOTEBOOKS_PER_FORMAT = 1;

/** Offline grace period after a successful online validation (days). */
export const LICENSE_OFFLINE_GRACE_DAYS = 14;

export type ProFeature =
  | 'spaceLimit'
  | 'notebookLimit'
  | 'articleNotebook'
  | 'sync';

/** Article notebooks (markdown / writer) require Pro to create beyond the free trial quota. */
export function isArticleNotebookFormat(format: NotebookFormatId): boolean {
  return format === 'markdown' || format === 'writer';
}
