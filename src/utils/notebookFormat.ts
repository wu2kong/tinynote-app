export type RegisteredNotebookFormatId = 'blocks' | 'markdown' | 'writer';
export type NotebookFormatId = RegisteredNotebookFormatId | 'unsupported';

export interface NotebookFormatDef {
  id: RegisteredNotebookFormatId;
  /** Canonical compound extension including `.md` for newly created files. */
  extension: string;
  /** Legacy suffixes that still map to this format (e.g. plain `.md` → blocks). */
  aliases?: readonly string[];
  labelKey: string;
}

/**
 * Notebook formats keyed by filename suffix.
 * Longer / more specific suffixes are matched first.
 * Register future formats (treemind / checklist / …) here.
 */
export const NOTEBOOK_FORMATS: readonly NotebookFormatDef[] = [
  { id: 'blocks', extension: '.blk.md', aliases: ['.md'], labelKey: 'directory.formats.blocks' },
  { id: 'markdown', extension: '.mk.md', labelKey: 'directory.formats.markdown' },
  { id: 'writer', extension: '.writer.md', labelKey: 'directory.formats.writer' },
] as const;

const FORMAT_BY_ID = Object.fromEntries(
  NOTEBOOK_FORMATS.map((format) => [format.id, format]),
) as Record<RegisteredNotebookFormatId, NotebookFormatDef>;

/** All known suffixes sorted longest-first for unambiguous matching. */
const SUFFIX_MATCHERS: readonly { format: RegisteredNotebookFormatId; suffix: string }[] = NOTEBOOK_FORMATS
  .flatMap((format) => [
    { format: format.id, suffix: format.extension },
    ...(format.aliases ?? []).map((suffix) => ({ format: format.id, suffix })),
  ])
  .sort((a, b) => b.suffix.length - a.suffix.length);

/** Extra token before `.md`, e.g. `.treemind.md` / `.checklist.md`. */
const COMPOUND_MD_SUFFIX_RE = /(\.[^./\\]+)\.md$/i;

export function getFormatDef(format: NotebookFormatId): NotebookFormatDef {
  if (format === 'unsupported') return FORMAT_BY_ID.blocks;
  return FORMAT_BY_ID[format] ?? FORMAT_BY_ID.blocks;
}

/** Canonical extension used when creating new notebooks of this format. */
export function getFormatExtension(format: NotebookFormatId): string {
  if (format === 'unsupported') return FORMAT_BY_ID.blocks.extension;
  return getFormatDef(format).extension;
}

/**
 * Compound `.token.md` suffix that is not registered in this app version.
 * Plain legacy `.md` and known format markers are not unknown.
 */
export function getUnknownNotebookFormatSuffix(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  if (!lower.endsWith('.md')) return null;

  for (const { suffix } of SUFFIX_MATCHERS) {
    if (suffix === '.md') continue;
    if (lower.endsWith(suffix)) return null;
  }

  const match = COMPOUND_MD_SUFFIX_RE.exec(lower);
  if (!match) return null;
  return fileName.slice(fileName.length - match[0].length);
}

export function getMatchedNotebookSuffix(fileName: string): string | null {
  const unknown = getUnknownNotebookFormatSuffix(fileName);
  if (unknown) return unknown;

  const lower = fileName.toLowerCase();
  for (const { suffix } of SUFFIX_MATCHERS) {
    if (lower.endsWith(suffix)) return fileName.slice(fileName.length - suffix.length);
  }
  return null;
}

export function detectNotebookFormat(fileName: string): NotebookFormatId {
  if (getUnknownNotebookFormatSuffix(fileName)) return 'unsupported';

  const lower = fileName.toLowerCase();
  for (const { format, suffix } of SUFFIX_MATCHERS) {
    if (lower.endsWith(suffix)) return format;
  }
  return 'blocks';
}

export function getNotebookDisplayName(fileName: string): string {
  const suffix = getMatchedNotebookSuffix(fileName);
  if (suffix) {
    return fileName.slice(0, fileName.length - suffix.length);
  }
  return fileName.replace(/\.md$/i, '');
}

export function isDocumentNotebookFormat(format: NotebookFormatId): boolean {
  return format === 'markdown' || format === 'writer';
}

export function isUnsupportedNotebookFormat(format: NotebookFormatId): boolean {
  return format === 'unsupported';
}

/** Markdown editor, including compatibility mode for unknown future suffixes. */
export function shouldUseMarkdownEditor(
  format: NotebookFormatId,
  compatOpenAsMarkdown?: boolean,
): boolean {
  return format === 'markdown' || !!compatOpenAsMarkdown;
}

/** Persist the raw document body instead of serializing note blocks. */
export function shouldSaveAsDocument(
  format: NotebookFormatId,
  compatOpenAsMarkdown?: boolean,
): boolean {
  return isDocumentNotebookFormat(format) || !!compatOpenAsMarkdown;
}

/**
 * Markdown and writer notes share the same document body.
 * Only the filename suffix (and therefore the editor view) differs.
 */
export function getSwappableArticleFormat(
  format: NotebookFormatId,
): Extract<NotebookFormatId, 'markdown' | 'writer'> | null {
  if (format === 'markdown') return 'writer';
  if (format === 'writer') return 'markdown';
  return null;
}

/** Rebuild a notebook filename with a different format suffix, keeping the display name. */
export function replaceNotebookFormatSuffix(
  fileName: string,
  targetFormat: NotebookFormatId,
): string {
  return buildNotebookFileName(getNotebookDisplayName(fileName), targetFormat);
}

export interface ResolvedNotebookFileName {
  fileName: string;
  format: NotebookFormatId;
  displayName: string;
}

export interface ResolveNotebookFileNameOptions {
  /** Keep this exact suffix (e.g. legacy `.md` when renaming an old notebook). */
  preserveExtension?: string | null;
}

/**
 * Resolve a user-entered notebook name into a concrete filename + format.
 * Accepts bare names, compound stems (`notes.blk` / `notes.mk`),
 * or full filenames (`notes.blk.md` / legacy `notes.md`).
 */
export function resolveNotebookFileName(
  inputName: string,
  preferredFormat: NotebookFormatId = 'blocks',
  options?: ResolveNotebookFileNameOptions,
): ResolvedNotebookFileName {
  const trimmed = inputName.trim();
  const preserved = options?.preserveExtension
    ? normalizePreserveExtension(options.preserveExtension, preferredFormat)
    : null;

  if (!trimmed) {
    const extension = preserved ?? getFormatExtension(preferredFormat);
    return {
      fileName: `untitled${extension}`,
      format: preferredFormat,
      displayName: 'untitled',
    };
  }

  if (/\.md$/i.test(trimmed)) {
    const format = detectNotebookFormat(trimmed);
    return {
      fileName: trimmed,
      format,
      displayName: getNotebookDisplayName(trimmed),
    };
  }

  for (const { format, suffix } of SUFFIX_MATCHERS) {
    const stem = suffix.replace(/\.md$/i, '');
    if (!stem || stem === '.') continue;
    if (trimmed.toLowerCase().endsWith(stem)) {
      const displayName = trimmed.slice(0, trimmed.length - stem.length);
      return {
        fileName: `${trimmed}.md`,
        format,
        displayName: displayName || trimmed,
      };
    }
  }

  const extension = preserved ?? getFormatExtension(preferredFormat);
  return {
    fileName: `${trimmed}${extension}`,
    format: preferredFormat,
    displayName: trimmed,
  };
}

function normalizePreserveExtension(
  extension: string,
  preferredFormat: NotebookFormatId,
): string {
  const normalized = extension.startsWith('.') ? extension : `.${extension}`;
  const lower = normalized.toLowerCase();
  if (getUnknownNotebookFormatSuffix(`stem${lower}`)) {
    return normalized;
  }
  for (const { format, suffix } of SUFFIX_MATCHERS) {
    if (suffix === lower && format === preferredFormat) {
      return normalized;
    }
  }
  return getFormatExtension(preferredFormat);
}

export function buildNotebookFileName(displayName: string, format: NotebookFormatId): string {
  return resolveNotebookFileName(displayName, format).fileName;
}

export function isMarkdownNotebookFileName(fileName: string): boolean {
  return /\.md$/i.test(fileName);
}

/**
 * True when the filename already carries a canonical format marker,
 * or an unknown compound `.token.md` suffix that a newer version may own.
 */
export function hasExplicitNotebookFormatMarker(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  if (NOTEBOOK_FORMATS.some((format) => lower.endsWith(format.extension.toLowerCase()))) {
    return true;
  }
  return getUnknownNotebookFormatSuffix(fileName) != null;
}

/**
 * Keep files that already have a built-in format marker.
 * Plain `.md` (no blk / mk / writer marker) is rewritten to `.writer.md`.
 */
export function resolveImportedNotebookFileName(fileName: string): { fileName: string; converted: boolean } {
  if (hasExplicitNotebookFormatMarker(fileName)) {
    return { fileName, converted: false };
  }
  return {
    fileName: buildNotebookFileName(getNotebookDisplayName(fileName), 'writer'),
    converted: true,
  };
}
