import React, { useState, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { X, Settings, Info, Database, ExternalLink, RefreshCw, Download, Loader2, Copy, FolderOpen, Check, Archive, HardDrive, GitBranch, ArrowDownToLine, Upload } from 'lucide-react';
import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useStore } from '@/store/useStore';
import { ColorThemeId, ViewMode } from '@/types';
import { COLOR_THEMES } from '@/themes';
import { HOMEPAGE_URL, APP_DESCRIPTION, AUTHOR_NAME, AUTHOR_URL, MIRROR_DOWNLOAD_URL } from '@/constants/app';
import { checkForUpdate, downloadAndInstall, formatUpdateError, getAppVersion, openReleasePage, UpdateInfo } from '@/utils/updater';
import { getConfigFilePath, getAppDirectory } from '@/utils/appPaths';
import { createBackup, formatBackupSize, getBackupStats, loadBackupDir, saveBackupDir, selectBackupDir, BackupStats } from '@/utils/backup';
import {
  getGitStatus, gitPull, gitSyncPush, getFileDiff, revertFileChange,
  formatSyncCommitMessage, getChangeBadge, getChangeTooltip, getDisplayDiffLines,
  GitSyncStatus, GitChangedFile, FileDiff,
} from '@/utils/sync';
import { joinPath, normalizePath } from '@/utils/path';
import * as fs from '@/utils/fileSystem';
import ConfirmModal from './ConfirmModal';
import { showToast } from './Toast';

type SettingsModule = 'general' | 'data' | 'backup' | 'sync' | 'about';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const MODULES: { id: SettingsModule; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: '通用', icon: <Settings size={16} /> },
  { id: 'data', label: '数据', icon: <Database size={16} /> },
  { id: 'sync', label: '同步', icon: <GitBranch size={16} /> },
  { id: 'backup', label: '备份', icon: <Archive size={16} /> },
  { id: 'about', label: '关于', icon: <Info size={16} /> },
];

const VIEW_MODE_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'list', label: '列表' },
  { value: 'card', label: '卡片' },
  { value: 'compact', label: '紧凑' },
];

const SettingsToggle: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    className={`settings-toggle ${checked ? 'active' : ''}`}
    onClick={onChange}
    role="switch"
    aria-checked={checked}
  >
    <span className="settings-toggle-thumb" />
  </button>
);

const GeneralSettings: React.FC = () => {
  const isDarkTheme = useStore((s) => s.isDarkTheme);
  const colorThemeId = useStore((s) => s.colorThemeId);
  const showAppBar = useStore((s) => s.showAppBar);
  const hideElementBorders = useStore((s) => s.hideElementBorders);
  const viewMode = useStore((s) => s.viewMode);
  const zoomLevel = useStore((s) => s.zoomLevel);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const setColorTheme = useStore((s) => s.setColorTheme);
  const toggleAppBar = useStore((s) => s.toggleAppBar);
  const toggleHideElementBorders = useStore((s) => s.toggleHideElementBorders);
  const setViewMode = useStore((s) => s.setViewMode);
  const zoomIn = useStore((s) => s.zoomIn);
  const zoomOut = useStore((s) => s.zoomOut);
  const resetZoom = useStore((s) => s.resetZoom);

  const currentTheme = COLOR_THEMES.find((theme) => theme.id === colorThemeId) ?? COLOR_THEMES[0];

  return (
    <div className="settings-panel">
      <h4 className="settings-panel-title">通用设置</h4>

      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">颜色主题</span>
          <span className="settings-row-desc">{currentTheme.description}</span>
        </div>
        <select
          className="settings-select"
          value={colorThemeId}
          onChange={(e) => setColorTheme(e.target.value as ColorThemeId)}
        >
          {COLOR_THEMES.map((theme) => (
            <option key={theme.id} value={theme.id}>{theme.label}</option>
          ))}
        </select>
      </div>

      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">深色模式</span>
          <span className="settings-row-desc">切换应用明暗主题</span>
        </div>
        <SettingsToggle checked={isDarkTheme} onChange={toggleTheme} />
      </div>

      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">显示空间栏</span>
          <span className="settings-row-desc">显示左侧空间导航栏</span>
        </div>
        <SettingsToggle checked={showAppBar} onChange={toggleAppBar} />
      </div>

      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">隐藏元素边框</span>
          <span className="settings-row-desc">开启极简风格，去除界面上不必要的边框</span>
        </div>
        <SettingsToggle checked={hideElementBorders} onChange={toggleHideElementBorders} />
      </div>

      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">默认视图</span>
          <span className="settings-row-desc">笔记列表的默认展示方式</span>
        </div>
        <select
          className="settings-select"
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as ViewMode)}
        >
          {VIEW_MODE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">界面缩放</span>
          <span className="settings-row-desc">调整界面显示比例</span>
        </div>
        <div className="settings-zoom-controls">
          <button type="button" className="btn btn-secondary settings-zoom-btn" onClick={zoomOut}>−</button>
          <span className="settings-zoom-value">{Math.round(zoomLevel * 100)}%</span>
          <button type="button" className="btn btn-secondary settings-zoom-btn" onClick={zoomIn}>+</button>
          <button type="button" className="btn btn-secondary settings-zoom-reset" onClick={resetZoom}>重置</button>
        </div>
      </div>
    </div>
  );
};

const PathItem: React.FC<{
  label: string;
  path: string | null;
  onSelect?: () => void;
  selectLabel?: string;
  compact?: boolean;
}> = ({ label, path, onSelect, selectLabel = '选择目录', compact = false }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!path) return;
    try {
      await writeText(path);
      setCopied(true);
      showToast('路径已复制');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        await navigator.clipboard.writeText(path);
        setCopied(true);
        showToast('路径已复制');
        setTimeout(() => setCopied(false), 2000);
      } catch {
        showToast('复制失败');
      }
    }
  }, [path]);

  const handleOpen = useCallback(async () => {
    if (!path) return;
    try {
      await revealItemInDir(path);
    } catch (e) {
      console.error('Failed to open path:', e);
      showToast('无法打开路径');
    }
  }, [path]);

  return (
    <div className={`settings-path-item${compact ? ' compact' : ''}`}>
      <div className="settings-path-header">
        <span className="settings-path-label">{label}</span>
        <div className="settings-path-actions">
          <button
            type="button"
            className="settings-path-btn"
            onClick={handleCopy}
            disabled={!path}
            title="复制路径"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            className="settings-path-btn"
            onClick={handleOpen}
            disabled={!path}
            title="在文件管理器中打开"
          >
            <FolderOpen size={14} />
          </button>
        </div>
      </div>
      <div className={`settings-path-value ${!path ? 'empty' : ''}`}>
        {path || '未设置'}
      </div>
      {!path && onSelect && (
        <button type="button" className="btn btn-secondary settings-path-select-btn" onClick={onSelect}>
          <HardDrive size={14} />
          {selectLabel}
        </button>
      )}
      {path && onSelect && (
        <button type="button" className="settings-path-change-btn" onClick={onSelect}>
          更改目录
        </button>
      )}
    </div>
  );
};

const BackupSettings: React.FC = () => {
  const storagePath = useStore((s) => s.storagePath);
  const [backupDir, setBackupDir] = useState<string | null>(null);
  const [configPath, setConfigPath] = useState<string | null>(null);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [backingUp, setBackingUp] = useState(false);

  const refreshStats = useCallback(async (dir: string | null) => {
    if (!dir) {
      setStats({ count: 0, latestFilename: null, latestTimeDisplay: null, files: [] });
      return;
    }
    try {
      const result = await getBackupStats(dir);
      setStats(result);
    } catch (e) {
      console.error('Failed to load backup stats:', e);
      setStats({ count: 0, latestFilename: null, latestTimeDisplay: null, files: [] });
    }
  }, []);

  useEffect(() => {
    loadBackupDir().then((dir) => {
      setBackupDir(dir);
      refreshStats(dir);
    }).catch((e) => {
      console.error('Failed to load backup dir:', e);
    });
    getConfigFilePath().then(setConfigPath).catch((e) => {
      console.error('Failed to get config path:', e);
    });
  }, [refreshStats]);

  const handleSelectBackupDir = useCallback(async () => {
    const selected = await selectBackupDir();
    if (!selected) return;
    try {
      await saveBackupDir(selected);
      setBackupDir(selected);
      await refreshStats(selected);
      showToast('备份目录已更新');
    } catch (e) {
      console.error('Failed to save backup dir:', e);
      showToast('保存备份目录失败');
    }
  }, [refreshStats]);

  const handleBackup = useCallback(async () => {
    if (!backupDir || !configPath || backingUp) return;
    setBackingUp(true);
    try {
      const filename = await createBackup(backupDir, storagePath, configPath);
      await refreshStats(backupDir);
      showToast(`备份完成：${filename}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '备份失败';
      console.error('Backup failed:', e);
      showToast(msg);
    } finally {
      setBackingUp(false);
    }
  }, [backupDir, configPath, storagePath, backingUp, refreshStats]);

  return (
    <div className="settings-panel settings-panel--compact">
      <div className="settings-panel-head">
        <h4 className="settings-panel-title">数据备份</h4>
        <p className="settings-panel-desc">将笔记库与配置文件打包为 zip</p>
      </div>

      <PathItem
        label="备份目录"
        path={backupDir}
        onSelect={handleSelectBackupDir}
        compact
      />

      <div className="settings-backup-summary">
        <span>共 <strong>{stats?.count ?? 0}</strong> 个备份</span>
        <span className="settings-backup-summary-sep">·</span>
        <span>
          最近 {stats?.latestTimeDisplay ?? '暂无'}
        </span>
      </div>

      <div className="settings-backup-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleBackup}
          disabled={!backupDir || backingUp}
        >
          {backingUp ? <Loader2 size={13} className="settings-spin" /> : <Archive size={13} />}
          {backingUp ? '备份中...' : '立即备份'}
        </button>
        {!backupDir && (
          <span className="settings-backup-hint">请先选择备份目录</span>
        )}
      </div>

      <div className="settings-backup-list">
        <div className="settings-backup-list-header">
          <span>备份文件</span>
          {(stats?.files.length ?? 0) > 0 && (
            <span className="settings-backup-list-count">{stats?.files.length}</span>
          )}
        </div>
        {!backupDir ? (
          <div className="settings-backup-list-empty">选择备份目录后显示文件列表</div>
        ) : (stats?.files.length ?? 0) === 0 ? (
          <div className="settings-backup-list-empty">暂无备份文件</div>
        ) : (
          <ul className="settings-backup-list-items">
            {stats!.files.map((file) => (
              <li key={file.filename} className="settings-backup-list-item">
                <span className="settings-backup-list-name" title={file.filename}>
                  {file.filename}
                </span>
                <span className="settings-backup-list-meta">
                  {file.timeDisplay && (
                    <span className="settings-backup-list-time">{file.timeDisplay}</span>
                  )}
                  <span className="settings-backup-list-size">{formatBackupSize(file.sizeBytes)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const DiffLine: React.FC<{ line: string }> = ({ line }) => {
  let className = 'settings-sync-diff-line';
  if (line.startsWith('+')) className += ' diff-add';
  else if (line.startsWith('-')) className += ' diff-del';
  return <div className={className}>{line || ' '}</div>;
};

const SyncDiffModal: React.FC<{
  open: boolean;
  filePath: string | null;
  diff: FileDiff | null;
  loading: boolean;
  onClose: () => void;
}> = ({ open, filePath, diff, loading, onClose }) => {
  if (!open || !filePath) return null;

  const displayLines = diff?.diff ? getDisplayDiffLines(diff.diff) : [];

  return (
    <div className="modal-overlay settings-sync-diff-overlay" onClick={onClose}>
      <div className="settings-sync-diff-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-sync-diff-header">
          <div>
            <h3 className="modal-title">查看变更</h3>
            <p className="settings-sync-diff-path" title={filePath}>{filePath}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </div>
        <div className="settings-sync-diff-body">
          {loading ? (
            <div className="settings-sync-diff-loading">
              <Loader2 size={18} className="settings-spin" />
              加载中...
            </div>
          ) : displayLines.length > 0 ? (
            displayLines.map((line, index) => (
              <DiffLine key={`${index}-${line.slice(0, 8)}`} line={line} />
            ))
          ) : (
            <div className="settings-sync-diff-empty">没有可显示的变更内容</div>
          )}
        </div>
      </div>
    </div>
  );
};

const SyncSettings: React.FC = () => {
  const storagePath = useStore((s) => s.storagePath);
  const [status, setStatus] = useState<GitSyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [copiedRemote, setCopiedRemote] = useState(false);
  const [copiedStoragePath, setCopiedStoragePath] = useState(false);
  const [diffModal, setDiffModal] = useState<{ open: boolean; file: GitChangedFile | null; data: FileDiff | null; loading: boolean }>({
    open: false,
    file: null,
    data: null,
    loading: false,
  });
  const [revertTarget, setRevertTarget] = useState<GitChangedFile | null>(null);
  const [revertingPath, setRevertingPath] = useState<string | null>(null);

  const refreshStatus = useCallback(async (options?: { toastOnSuccess?: boolean }) => {
    if (!storagePath) {
      setStatus(null);
      return;
    }
    setLoading(true);
    setSyncError(null);
    try {
      const result = await getGitStatus(storagePath);
      setStatus(result);
      if (result.statusError) {
        setSyncError(`读取 Git 状态失败：${result.statusError}`);
      } else if (options?.toastOnSuccess) {
        showToast('同步状态已刷新');
      }
    } catch (e) {
      console.error('Failed to load git status:', e);
      const msg = e instanceof Error ? e.message : '读取 Git 状态失败';
      setStatus(null);
      setSyncError(msg);
      showToast(msg);
    } finally {
      setLoading(false);
    }
  }, [storagePath]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleCopyRemote = useCallback(async () => {
    const url = status?.remoteUrl;
    if (!url) return;
    try {
      await writeText(url);
      setCopiedRemote(true);
      showToast('仓库地址已复制');
      setTimeout(() => setCopiedRemote(false), 2000);
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setCopiedRemote(true);
        showToast('仓库地址已复制');
        setTimeout(() => setCopiedRemote(false), 2000);
      } catch {
        showToast('复制失败');
      }
    }
  }, [status?.remoteUrl]);

  const handleCopyStoragePath = useCallback(async () => {
    if (!storagePath) return;
    try {
      await writeText(storagePath);
      setCopiedStoragePath(true);
      showToast('笔记库路径已复制');
      setTimeout(() => setCopiedStoragePath(false), 2000);
    } catch {
      try {
        await navigator.clipboard.writeText(storagePath);
        setCopiedStoragePath(true);
        showToast('笔记库路径已复制');
        setTimeout(() => setCopiedStoragePath(false), 2000);
      } catch {
        showToast('复制失败');
      }
    }
  }, [storagePath]);

  const handleOpenRepo = useCallback(async () => {
    if (!storagePath) return;
    try {
      await revealItemInDir(storagePath);
    } catch (e) {
      console.error('Failed to open repo path:', e);
      showToast('无法打开目录');
    }
  }, [storagePath]);

  const handlePull = useCallback(async () => {
    if (!storagePath || pulling) return;
    flushSync(() => {
      setPulling(true);
      setSyncError(null);
    });
    try {
      await gitPull(storagePath);
      showToast('拉取完成');
      await refreshStatus();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '拉取失败';
      setSyncError(`拉取失败：${msg}\n\n请在终端进入笔记库目录，手动执行 git pull 解决冲突或认证问题。`);
      showToast('拉取失败，请手动处理');
    } finally {
      setPulling(false);
    }
  }, [storagePath, pulling, refreshStatus]);

  const handlePush = useCallback(async () => {
    if (!storagePath || pushing) return;
    if ((status?.changedMdCount ?? 0) === 0) {
      showToast('没有需要提交的内容');
      return;
    }
    flushSync(() => {
      setPushing(true);
      setSyncError(null);
    });
    try {
      const message = await gitSyncPush(storagePath);
      showToast(`已推送：${message}`);
      await refreshStatus();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '推送失败';
      if (msg === '没有需要提交的内容') {
        showToast(msg);
        return;
      }
      setSyncError(`提交/推送失败：${msg}\n\n请在终端进入笔记库目录，手动执行 git status 查看状态并解决冲突或认证问题。`);
      showToast('推送失败，请手动处理');
    } finally {
      setPushing(false);
    }
  }, [storagePath, pushing, refreshStatus, status?.changedMdCount]);

  const reloadOpenNotebookIfNeeded = useCallback(async (relativePath: string, deleted: boolean) => {
    if (!storagePath) return;
    const absPath = normalizePath(joinPath(storagePath, relativePath));
    const { currentNotebook } = useStore.getState();
    if (!currentNotebook || normalizePath(currentNotebook.path) !== absPath) return;

    if (deleted) {
      useStore.setState({ currentNotebook: null, currentNoteBlock: null });
      return;
    }

    const loaded = await fs.loadNotebook(absPath);
    if (loaded) {
      useStore.setState({ currentNotebook: loaded, currentNoteBlock: null });
    }
  }, [storagePath]);

  const handleViewDiff = useCallback(async (file: GitChangedFile) => {
    if (!storagePath) return;
    setDiffModal({ open: true, file, data: null, loading: true });
    try {
      const data = await getFileDiff(storagePath, file.path);
      setDiffModal({ open: true, file, data, loading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '读取变更失败';
      showToast(msg);
      setDiffModal({ open: false, file: null, data: null, loading: false });
    }
  }, [storagePath]);

  const handleRevert = useCallback(async (file: GitChangedFile) => {
    if (!storagePath || revertingPath) return;
    setRevertingPath(file.path);
    setSyncError(null);
    try {
      await revertFileChange(storagePath, file.path);
      await reloadOpenNotebookIfNeeded(file.path, file.changeType === 'added');
      if (file.changeType === 'deleted') {
        await reloadOpenNotebookIfNeeded(file.path, false);
      }
      showToast(`已撤销：${file.path}`);
      await refreshStatus();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '撤销失败';
      setSyncError(`撤销失败：${msg}\n\n请在终端进入笔记库目录，手动处理该文件。`);
      showToast(msg);
    } finally {
      setRevertingPath(null);
      setRevertTarget(null);
    }
  }, [storagePath, revertingPath, refreshStatus, reloadOpenNotebookIfNeeded]);

  const commitPreview = status ? formatSyncCommitMessage(status.hostname) : '';
  const busy = pulling || pushing;

  return (
    <div className="settings-panel settings-panel--compact">
      <div className="settings-panel-head">
        <div className="settings-panel-head-row">
          <div>
            <h4 className="settings-panel-title">Git 同步</h4>
            <p className="settings-panel-desc">通过 Git 在多设备间同步 Markdown 笔记</p>
          </div>
          <button
            type="button"
            className="settings-path-btn"
            onClick={() => refreshStatus({ toastOnSuccess: true })}
            disabled={!storagePath || loading || busy}
            title="刷新状态"
          >
            {loading ? <Loader2 size={14} className="settings-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      </div>

      {!storagePath ? (
        <div className="settings-sync-empty">请先在「数据」中设置笔记库目录</div>
      ) : !status?.isRepo ? (
        <div className="settings-sync-empty">
          <p>当前笔记库目录尚未初始化为 Git 仓库。</p>
          <p className="settings-sync-empty-hint">
            在终端进入该目录，执行 <code>git init</code> 并配置 remote 后即可使用同步功能。
          </p>
          <button type="button" className="btn btn-secondary btn-sm settings-sync-open-btn" onClick={handleOpenRepo}>
            <FolderOpen size={13} />
            打开笔记库目录
          </button>
        </div>
      ) : (
        <>
          <div className="settings-sync-info">
            <div className="settings-sync-info-row">
              <span className="settings-sync-info-label">远程仓库</span>
              <div className="settings-sync-info-value-row">
                <span className="settings-sync-remote" title={status.remoteUrl ?? undefined}>
                  {status.remoteUrl ?? '未配置 origin 远程'}
                </span>
                {status.remoteUrl && (
                  <button
                    type="button"
                    className="settings-path-btn"
                    onClick={handleCopyRemote}
                    title="复制仓库地址"
                  >
                    {copiedRemote ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                )}
              </div>
            </div>
            <div className="settings-sync-info-row">
              <span className="settings-sync-info-label">笔记库目录</span>
              <div className="settings-sync-info-value-row">
                <span className="settings-sync-remote" title={storagePath ?? undefined}>
                  {storagePath}
                </span>
                <button
                  type="button"
                  className="settings-path-btn"
                  onClick={handleCopyStoragePath}
                  title="复制笔记库路径"
                >
                  {copiedStoragePath ? <Check size={14} /> : <Copy size={14} />}
                </button>
                <button
                  type="button"
                  className="settings-path-btn"
                  onClick={handleOpenRepo}
                  title="在文件管理器中打开"
                >
                  <FolderOpen size={14} />
                </button>
              </div>
            </div>
            {status.branch && (
              <div className="settings-sync-info-row">
                <span className="settings-sync-info-label">当前分支</span>
                <span className="settings-sync-branch">{status.branch}</span>
              </div>
            )}
          </div>

          <div className="settings-backup-summary settings-sync-summary">
            <span>待同步 <strong>{status.changedMdCount}</strong> 个 .md 文件</span>
            {(status.ahead > 0 || status.behind > 0) && (
              <>
                <span className="settings-backup-summary-sep">·</span>
                {status.behind > 0 && <span>落后远程 {status.behind} 提交</span>}
                {status.behind > 0 && status.ahead > 0 && <span className="settings-backup-summary-sep">·</span>}
                {status.ahead > 0 && <span>领先远程 {status.ahead} 提交</span>}
              </>
            )}
          </div>

          <div className="settings-sync-commit-preview">
            提交信息：<code>{commitPreview}</code>
          </div>

          <div className="settings-backup-actions settings-sync-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handlePull}
              disabled={!status.hasRemote || busy}
              title={!status.hasRemote ? '请先配置 origin 远程' : undefined}
            >
              {pulling ? <Loader2 size={13} className="settings-spin" /> : <ArrowDownToLine size={13} />}
              {pulling ? '拉取中...' : '拉取最新'}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handlePush}
              disabled={!status.hasRemote || busy}
              title={!status.hasRemote ? '请先配置 origin 远程' : undefined}
            >
              {pushing ? <Loader2 size={13} className="settings-spin" /> : <Upload size={13} />}
              {pushing ? '推送中...' : '提交并推送'}
            </button>
          </div>

          {syncError && (
            <div className="settings-sync-error">
              <pre>{syncError}</pre>
            </div>
          )}

          <div className="settings-backup-list">
            <div className="settings-backup-list-header">
              <span>变更的 Markdown 文件</span>
              {status.changedFiles.length > 0 && (
                <span className="settings-backup-list-count">{status.changedFiles.length}</span>
              )}
            </div>
            {status.changedFiles.length === 0 ? (
              <div className="settings-backup-list-empty">没有待提交的 .md 变更</div>
            ) : (
              <ul className="settings-backup-list-items settings-sync-file-list">
                {status.changedFiles.map((file) => (
                  <li
                    key={file.path}
                    className="settings-sync-file-item"
                    title={getChangeTooltip(file.changeType, file.path)}
                  >
                    <span className={`settings-sync-file-badge is-${file.changeType}`}>
                      {getChangeBadge(file.changeType)}
                    </span>
                    <div className="settings-sync-file-path-wrap">
                      <span className="settings-sync-file-path">{file.path}</span>
                    </div>
                    <div className="settings-sync-file-actions">
                      <button
                        type="button"
                        className="settings-sync-file-link"
                        onClick={() => handleViewDiff(file)}
                        disabled={busy || revertingPath === file.path}
                      >
                        查看变更
                      </button>
                      <button
                        type="button"
                        className="settings-sync-file-link settings-sync-file-link-muted"
                        onClick={() => setRevertTarget(file)}
                        disabled={busy || revertingPath === file.path}
                      >
                        {revertingPath === file.path ? '撤销中...' : '撤销变更'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <SyncDiffModal
            open={diffModal.open}
            filePath={diffModal.file?.path ?? null}
            diff={diffModal.data}
            loading={diffModal.loading}
            onClose={() => setDiffModal({ open: false, file: null, data: null, loading: false })}
          />

          <ConfirmModal
            open={!!revertTarget}
            onClose={() => setRevertTarget(null)}
            onConfirm={() => { if (revertTarget) handleRevert(revertTarget); }}
            title="撤销变更"
            message={
              revertTarget?.changeType === 'added'
                ? `确定删除新文件「${revertTarget.path}」吗？此操作不可恢复。`
                : revertTarget?.changeType === 'deleted'
                  ? `确定恢复已删除的文件「${revertTarget.path}」吗？`
                  : `确定将「${revertTarget?.path ?? ''}」恢复到最后一次提交的版本吗？当前未提交的修改将丢失。`
            }
            confirmLabel="撤销"
          />
        </>
      )}
    </div>
  );
};

const DataSettings: React.FC = () => {
  const storagePath = useStore((s) => s.storagePath);
  const [configPath, setConfigPath] = useState<string | null>(null);
  const [appDir, setAppDir] = useState<string | null>(null);

  useEffect(() => {
    getConfigFilePath().then(setConfigPath).catch((e) => {
      console.error('Failed to get config path:', e);
    });
    getAppDirectory().then(setAppDir).catch((e) => {
      console.error('Failed to get app directory:', e);
    });
  }, []);

  return (
    <div className="settings-panel">
      <h4 className="settings-panel-title">数据路径</h4>
      <p className="settings-panel-desc">查看应用相关的配置文件与数据目录位置</p>

      <PathItem label="配置文件路径" path={configPath} />
      <PathItem label="笔记库目录" path={storagePath} />
      <PathItem label="程序所在目录" path={appDir} />
    </div>
  );
};

const AboutSettings: React.FC = () => {
  const [version, setVersion] = useState('');
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checkMessage, setCheckMessage] = useState('');

  useEffect(() => {
    getAppVersion().then(setVersion);
  }, []);

  const handleCheckUpdate = useCallback(async () => {
    setChecking(true);
    setCheckMessage('');
    setUpdateInfo(null);
    try {
      const info = await checkForUpdate();
      if (info) {
        setUpdateInfo(info);
        setCheckMessage(`发现新版本 v${info.latestVersion}`);
      } else {
        setCheckMessage('当前已是最新版本');
      }
    } catch (e) {
      const msg = formatUpdateError(e, '检查更新失败');
      setCheckMessage(msg);
      showToast(msg);
    } finally {
      setChecking(false);
    }
  }, []);

  const handleDownloadUpdate = useCallback(async () => {
    if (!updateInfo) return;
    setDownloading(true);
    try {
      await downloadAndInstall(updateInfo.asset);
      showToast('安装程序已启动，请按提示完成更新');
    } catch (e) {
      const msg = formatUpdateError(e, '下载更新失败，请检查网络连接是否正常');
      showToast(msg);
      setCheckMessage(msg);
    } finally {
      setDownloading(false);
    }
  }, [updateInfo]);

  const handleManualDownload = useCallback(async () => {
    if (!updateInfo) return;
    try {
      await openReleasePage(updateInfo.releaseUrl);
    } catch (e) {
      console.error('Failed to open release page:', e);
      showToast('无法打开 GitHub Release 页面');
    }
  }, [updateInfo]);

  const handleMirrorDownload = useCallback(async () => {
    try {
      await openUrl(MIRROR_DOWNLOAD_URL);
    } catch (e) {
      console.error('Failed to open mirror download page:', e);
      showToast('无法打开蓝奏云下载页面');
    }
  }, []);

  const handleOpenHomepage = useCallback(async () => {
    try {
      await openUrl(HOMEPAGE_URL);
    } catch (e) {
      console.error('Failed to open homepage:', e);
      showToast('无法打开项目主页');
    }
  }, []);

  const handleOpenAuthorHomepage = useCallback(async () => {
    try {
      await openUrl(AUTHOR_URL);
    } catch (e) {
      console.error('Failed to open author homepage:', e);
      showToast('无法打开作者主页');
    }
  }, []);

  return (
    <div className="settings-panel">
      <h4 className="settings-panel-title">关于 TinyNote</h4>

      <div className="settings-about-card">
        <div className="settings-about-logo">📝</div>
        <div className="settings-about-info">
          <div className="settings-about-name">TinyNote</div>
          <div className="settings-about-version">版本 {version || '...'}</div>
          <div className="settings-about-desc">{APP_DESCRIPTION}</div>
        </div>
      </div>

      <div className="settings-row settings-row-vertical">
        <div className="settings-row-info">
          <span className="settings-row-label">项目作者</span>
          <button type="button" className="settings-link" onClick={handleOpenAuthorHomepage}>
            {AUTHOR_NAME}
            <ExternalLink size={14} />
          </button>
          <span className="settings-row-desc">{AUTHOR_URL}</span>
        </div>
      </div>

      <div className="settings-row settings-row-vertical">
        <div className="settings-row-info">
          <span className="settings-row-label">项目主页</span>
          <button type="button" className="settings-link" onClick={handleOpenHomepage}>
            {HOMEPAGE_URL}
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      <div className="settings-row settings-row-vertical">
        <div className="settings-row-info">
          <span className="settings-row-label">软件更新</span>
          <span className="settings-row-desc">从 GitHub Releases 检查并下载最新版本；无法访问 GitHub 时可使用蓝奏云镜像</span>
        </div>
        <div className="settings-update-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCheckUpdate}
            disabled={checking || downloading}
          >
            {checking ? <Loader2 size={14} className="settings-spin" /> : <RefreshCw size={14} />}
            检查更新
          </button>
          {updateInfo && (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleDownloadUpdate}
                disabled={downloading}
              >
                {downloading ? <Loader2 size={14} className="settings-spin" /> : <Download size={14} />}
                下载并更新
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleManualDownload}
                disabled={downloading}
              >
                <ExternalLink size={14} />
                GitHub 下载
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleMirrorDownload}
                disabled={downloading}
              >
                <ExternalLink size={14} />
                蓝奏云下载
              </button>
            </>
          )}
        </div>
        {checkMessage && (
          <p className={`settings-update-message ${updateInfo ? 'has-update' : ''}`}>
            {checkMessage}
          </p>
        )}
      </div>
    </div>
  );
};

const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  const [activeModule, setActiveModule] = useState<SettingsModule>('general');

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h3 className="modal-title">设置中心</h3>
          <button type="button" className="icon-btn" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="settings-modal-body">
          <nav className="settings-nav">
            {MODULES.map((mod) => (
              <button
                key={mod.id}
                type="button"
                className={`settings-nav-item ${activeModule === mod.id ? 'active' : ''}`}
                onClick={() => setActiveModule(mod.id)}
              >
                {mod.icon}
                <span>{mod.label}</span>
              </button>
            ))}
          </nav>

          <div className="settings-content">
            {activeModule === 'general' && <GeneralSettings />}
            {activeModule === 'data' && <DataSettings />}
            {activeModule === 'sync' && <SyncSettings />}
            {activeModule === 'backup' && <BackupSettings />}
            {activeModule === 'about' && <AboutSettings />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
