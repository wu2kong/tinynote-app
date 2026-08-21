export type GitChangeType = 'added' | 'modified' | 'deleted';

export interface GitChangedFile {
  path: string;
  changeType: GitChangeType;
}

export interface GitRemoteInfo {
  name: string;
  url: string;
}

export interface GitSyncStatus {
  isRepo: boolean;
  remotes: GitRemoteInfo[];
  remoteUrl: string | null;
  primaryRemote: string | null;
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

export interface GitInitResult {
  created: boolean;
  branch: string;
}

export interface GitPushRemoteResult {
  remote: string;
  ok: boolean;
  error?: string | null;
}

export interface GitPushResult {
  message: string;
  results: GitPushRemoteResult[];
}

export interface GitPullOptions {
  remote?: string | null;
  auth?: SyncAuth | null;
  allowUnrelated?: boolean;
}

export interface GitPushOptions {
  remotes?: string[];
  authByRemote?: Record<string, SyncAuth>;
}

export interface SyncAdapter {
  getGitStatus(storagePath: string, primaryRemote?: string | null): Promise<GitSyncStatus>;
  gitInit(storagePath: string): Promise<GitInitResult>;
  listRemotes(storagePath: string): Promise<GitRemoteInfo[]>;
  addRemote(storagePath: string, name: string, url: string): Promise<void>;
  removeRemote(storagePath: string, name: string): Promise<void>;
  gitPull(storagePath: string, options?: GitPullOptions): Promise<void>;
  gitSyncPush(storagePath: string, options?: GitPushOptions): Promise<GitPushResult>;
  getFileDiff(storagePath: string, filePath: string): Promise<FileDiff>;
  revertFileChange(storagePath: string, filePath: string): Promise<void>;
}
