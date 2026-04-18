export interface NoteBlock {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Notebook {
  id: string;
  name: string;
  path: string;
  noteBlocks: NoteBlock[];
  isSourceMode: boolean;
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
  groups: Group[];
}

export type ViewMode = 'list' | 'card' | 'compact';

export interface AppState {
  spaces: Space[];
  currentSpace: Space | null;
  currentGroup: Group | null;
  currentNotebook: Notebook | null;
  currentNoteBlock: NoteBlock | null;
  isDarkTheme: boolean;
  isSidebarCollapsed: boolean;
  viewMode: ViewMode;
  searchQuery: string;
  storagePath: string | null;
}