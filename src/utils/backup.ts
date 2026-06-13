import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import * as config from './config';
import { normalizePath } from './path';

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
  const selected = await open({
    directory: true,
    multiple: false,
    recursive: true,
  });
  return selected ? normalizePath(selected as string) : null;
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
