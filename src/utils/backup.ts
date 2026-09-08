import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import * as config from './config';
import { normalizePath } from './path';
import { persistScopedAccess, pickWorkspaceFolder } from './scopedAccess';
import { IS_MAC_APP_STORE } from '@/constants/distribution';

export interface BackupFile {
  filename: string;
  timeDisplay: string | null;
  sizeBytes: number;
}

export interface BackupStats {
  count: number;
  latestFilename: string | null;
  latestTimeDisplay: string | null;
  files: BackupFile[];
}

export async function getBackupStats(backupDir: string): Promise<BackupStats> {
  return invoke<BackupStats>('get_backup_stats', { backupDir });
}

export async function createBackup(
  backupDir: string,
  storagePath: string | null,
  configPath: string,
): Promise<string> {
  return invoke<string>('create_backup', { backupDir, storagePath, configPath });
}

export async function selectBackupDir(): Promise<string | null> {
  if (IS_MAC_APP_STORE) {
    try {
      const picked = await pickWorkspaceFolder();
      return picked ? normalizePath(picked) : null;
    } catch (error) {
      console.warn('[tinynote] Native folder picker failed, falling back:', error);
    }
  }
  const selected = await open({
    directory: true,
    multiple: false,
    recursive: true,
  });
  if (!selected) return null;
  const path = normalizePath(selected as string);
  await persistScopedAccess(path);
  return path;
}

export async function loadBackupDir(): Promise<string | null> {
  const cfg = await config.loadConfig();
  return cfg.backupDir;
}

export async function saveBackupDir(path: string | null): Promise<void> {
  await config.saveConfig({ backupDir: path ? normalizePath(path) : null });
}

export function formatBackupSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
