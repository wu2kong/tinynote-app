import React, { useState, useEffect, useCallback } from 'react';
import { X, Settings, Info, Database, ExternalLink, RefreshCw, Download, Loader2, Copy, FolderOpen, Check, Archive, HardDrive } from 'lucide-react';
import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useStore } from '@/store/useStore';
import { ViewMode } from '@/types';
import { HOMEPAGE_URL, APP_DESCRIPTION, AUTHOR_NAME, AUTHOR_URL } from '@/constants/app';
import { checkForUpdate, downloadAndInstall, getAppVersion, UpdateInfo } from '@/utils/updater';
import { getConfigFilePath, getAppDirectory } from '@/utils/appPaths';
import { createBackup, formatBackupSize, getBackupStats, loadBackupDir, saveBackupDir, selectBackupDir, BackupStats } from '@/utils/backup';
import { showToast } from './Toast';

type SettingsModule = 'general' | 'data' | 'backup' | 'about';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const MODULES: { id: SettingsModule; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: '通用', icon: <Settings size={16} /> },
  { id: 'data', label: '数据', icon: <Database size={16} /> },
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
  const showAppBar = useStore((s) => s.showAppBar);
  const viewMode = useStore((s) => s.viewMode);
  const zoomLevel = useStore((s) => s.zoomLevel);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const toggleAppBar = useStore((s) => s.toggleAppBar);
  const setViewMode = useStore((s) => s.setViewMode);
  const zoomIn = useStore((s) => s.zoomIn);
  const zoomOut = useStore((s) => s.zoomOut);
  const resetZoom = useStore((s) => s.resetZoom);

  return (
    <div className="settings-panel">
      <h4 className="settings-panel-title">通用设置</h4>

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
      const msg = e instanceof Error ? e.message : '检查更新失败';
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
      const msg = e instanceof Error ? e.message : '下载更新失败';
      showToast(msg);
      setCheckMessage(msg);
    } finally {
      setDownloading(false);
    }
  }, [updateInfo]);

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
          <span className="settings-row-desc">从 GitHub Releases 检查并下载最新版本</span>
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
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleDownloadUpdate}
              disabled={downloading}
            >
              {downloading ? <Loader2 size={14} className="settings-spin" /> : <Download size={14} />}
              下载并更新
            </button>
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
            {activeModule === 'backup' && <BackupSettings />}
            {activeModule === 'about' && <AboutSettings />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
