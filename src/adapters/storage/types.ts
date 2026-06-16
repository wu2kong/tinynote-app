export interface DirEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

export interface FileStat {
  isFile: boolean;
  isDirectory: boolean;
}

export interface StorageAdapter {
  readonly kind: 'tauri' | 'web';
  /** Default library root when user has not chosen a path yet. */
  readonly defaultStoragePath: string;
  selectStoragePath(): Promise<string | null>;
  readDir(path: string): Promise<DirEntry[]>;
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
  mkdir(path: string, recursive?: boolean): Promise<void>;
  remove(path: string, recursive?: boolean): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<FileStat>;
}
