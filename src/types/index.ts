import type { AppLocale } from '@/i18n';
import type { NotebookFormatId } from '@/utils/notebookFormat';

export type ContentType = 'text' | 'json' | 'xml' | 'ini' | 'yaml' | 'css' | 'html' | 'bash' | 'shell' | 'sql' | 'javascript' | 'typescript' | 'python' | 'java' | 'go' | 'rust' | 'markdown';

export type { NotebookFormatId };

export interface NoteBlock {
  id: string;
  title: string;
  content: string;
  contentType: ContentType;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Notebook {
  id: string;
  name: string;
  path: string;
  /** Determined by filename suffix, e.g. `.blk.md` / legacy `.md` (blocks), `.mk.md`, `.writer.md`. */
  format: NotebookFormatId;
  noteBlocks: NoteBlock[];
  /** Raw document body for non-block formats (markdown, future writer/treemind, …). */
  content: string;
  isSourceMode: boolean;
  /**
   * User chose to open an unknown future-format note in the Markdown editor.
   * Filename is unchanged; saves write the raw document body.
   */
  compatOpenAsMarkdown?: boolean;
}

export interface RecentNotebookHistoryItem {
  path: string;
  name: string;
  spacePath: string;
  openedAt: string;
}

export interface Group {
  id: string;
  name: string;
  path: string;
  children: (Group | Notebook)[];
  notebookCount: number;
}

export interface Space {
  id: string;
  name: string;
  path: string;
  icon?: string;
  /** Space-group ids this space belongs to. Empty means only visible under "All". */
  groupIds?: string[];
  groups: (Group | Notebook)[];
}

export type ViewMode = 'list' | 'card' | 'compact';

export type ColorThemeId = 'default' | 'qinglan' | 'sunset' | 'paper' | 'matcha';

export type SpaceGroupDisplayMode = 'disabled' | 'dropdown' | 'collapse';

export interface SpaceGroupDef {
  id: string;
  name: string;
}

export type { AppLocale };

export interface AppState {
  spaces: Space[];
  currentSpace: Space | null;
  currentGroup: Group | null;
  currentNotebook: Notebook | null;
  currentNoteBlock: NoteBlock | null;
  noteBlockFocusKey: number;
  recentNotebookHistory: RecentNotebookHistoryItem[];
  isDarkTheme: boolean;
  colorThemeId: ColorThemeId;
  displayLanguage: AppLocale;
  isSidebarCollapsed: boolean;
  showAppBar: boolean;
  showDirectoryPanel: boolean;
  hideElementBorders: boolean;
  viewMode: ViewMode;
  zoomLevel: number;
  searchQuery: string;
  storagePath: string | null;
  expandedGroupPaths: string[];
  spaceGroups: SpaceGroupDef[];
  currentSpaceGroupId: string;
  spaceGroupDisplayMode: SpaceGroupDisplayMode;
}
