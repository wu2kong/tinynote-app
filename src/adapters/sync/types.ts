export type GitChangeType = 'added' | 'modified' | 'deleted';

export interface GitChangedFile {
  path: string;
  changeType: GitChangeType;
}

export interface GitSyncStatus {
  isRepo: boolean;
  remoteUrl: string | null;
  branch: string | null;
  changedMdCount: number;
  changedFiles: GitChangedFile[];
  ahead: number;
  behind: number;
  hasRemote: boolean;
  hostname: string;
  statusError: string | null;
}

export interface FileDiff {
  diff: string;
  changeType: string;
  isNewFile: boolean;
}

export interface SyncAuth {
  username: string;
  password: string;
}

export interface SyncRuntimeOptions {
  corsProxy: string;
  auth: SyncAuth | null;
}

export interface SyncAdapter {
  getGitStatus(storagePath: string): Promise<GitSyncStatus>;
  gitPull(storagePath: string): Promise<void>;
  gitSyncPush(storagePath: string): Promise<string>;
  getFileDiff(storagePath: string, filePath: string): Promise<FileDiff>;
  revertFileChange(storagePath: string, filePath: string): Promise<void>;
}
