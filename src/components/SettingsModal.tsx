import React, { useState, useEffect, useCallback } from 'react';
import { X, Settings, Info, Database, ExternalLink, RefreshCw, Download, Loader2, Copy, FolderOpen, Check } from 'lucide-react';
import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useStore } from '@/store/useStore';
import { ViewMode } from '@/types';
import { HOMEPAGE_URL, APP_DESCRIPTION, AUTHOR_NAME, AUTHOR_URL } from '@/constants/app';
import { checkForUpdate, downloadAndInstall, getAppVersion, UpdateInfo } from '@/utils/updater';
import { getConfigFilePath, getAppDirectory } from '@/utils/appPaths';
import { showToast } from './Toast';

type SettingsModule = 'general' | 'data' | 'about';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const MODULES: { id: SettingsModule; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: '通用', icon: <Settings size={16} /> },
  { id: 'data', label: '数据', icon: <Database size={16} /> },
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
}> = ({ label, path }) => {
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
    <div className="settings-path-item">
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
            {activeModule === 'about' && <AboutSettings />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
