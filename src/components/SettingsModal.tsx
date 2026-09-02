import React, { useState, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { X, Settings, Info, Database, ExternalLink, RefreshCw, Download, Loader2, Copy, FolderOpen, Check, Archive, HardDrive, GitBranch, Bot, KeyRound, Crown, Mail, MessageSquare, BookOpen } from 'lucide-react';
import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useStore } from '@/store/useStore';
import { ColorThemeId, NoteBlockDoubleClickAction, SpaceGroupDisplayMode, ViewMode } from '@/types';
import { COLOR_THEMES } from '@/themes';
import { HOMEPAGE_URL, DOCS_URL, DOWNLOAD_PAGE_URL, GITHUB_RELEASES_URL, AUTHOR_NAME, AUTHOR_URL, MIRROR_DOWNLOAD_URL, PURCHASE_URL, FEEDBACK_EMAIL } from '@/constants/app';
import { checkForUpdate, checkWithNativeUpdater, downloadAndInstall, formatUpdateError, getAppVersion, UpdateInfo } from '@/utils/updater';
import { getConfigFilePath, getAppDirectory, getWorkspacesFilePath } from '@/utils/appPaths';
import { createBackup, formatBackupSize, getBackupStats, loadBackupDir, saveBackupDir, selectBackupDir, BackupStats } from '@/utils/backup';
import { getPlatform, isTauri } from '@/platform/detect';
import AISettings from '@/components/AISettings';
import OfficialSampleLibraryModal from './OfficialSampleLibraryModal';
import SyncSettings from './sync/SyncSettings';
import { showToast } from './Toast';
import { useI18n, type AppLocale } from '@/i18n/useI18n';
import { useLicenseStore } from '@/store/useLicenseStore';
import { IS_MAC_APP_STORE } from '@/constants/distribution';
import { AppStorePurchaseControls } from './AppStorePurchaseControls';

type SettingsModule = 'general' | 'ai' | 'data' | 'sampleLibrary' | 'shortcuts' | 'backup' | 'sync' | 'pro' | 'feedback' | 'about';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const MODULES: { id: SettingsModule; icon: React.ReactNode }[] = [
  { id: 'general', icon: <Settings size={16} /> },
  { id: 'data', icon: <Database size={16} /> },
  { id: 'sampleLibrary', icon: <BookOpen size={16} /> },
  { id: 'sync', icon: <GitBranch size={16} /> },
  { id: 'backup', icon: <Archive size={16} /> },
  ...(!IS_MAC_APP_STORE ? [{ id: 'ai' as const, icon: <Bot size={16} /> }] : []),
  { id: 'shortcuts', icon: <KeyRound size={16} /> },
  { id: 'pro', icon: <Crown size={16} /> },
  { id: 'feedback', icon: <MessageSquare size={16} /> },
  { id: 'about', icon: <Info size={16} /> },
];

function detectOsLabel(): string {
  if (typeof navigator === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;
  const platform = navigator.platform || '';
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return 'Windows';
  if (/Mac/i.test(platform) || /Macintosh/i.test(ua)) return 'macOS';
  if (/Linux/i.test(platform) || /Linux/i.test(ua)) return 'Linux';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  return platform || 'Unknown';
}

function buildDiagnosticInfo(version: string): string {
  const runtime = getPlatform();
  const os = detectOsLabel();
  const lines = [
    `App: TinyNote`,
    `Version: ${version || 'unknown'}`,
    `Runtime: ${runtime}`,
    `OS: ${os}`,
    `Tauri: ${isTauri() ? 'yes' : 'no'}`,
  ];
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    lines.push(`User-Agent: ${navigator.userAgent}`);
  }
  return lines.join('\n');
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await writeText(text);
    return true;
  } catch {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}

const VIEW_MODE_OPTIONS: { value: ViewMode; labelKey: string }[] = [
  { value: 'list', labelKey: 'settings.general.viewList' },
  { value: 'card', labelKey: 'settings.general.viewCard' },
  { value: 'compact', labelKey: 'settings.general.viewCompact' },
];

const NOTE_BLOCK_DOUBLE_CLICK_OPTIONS: { value: NoteBlockDoubleClickAction; labelKey: string }[] = [
  { value: 'none', labelKey: 'settings.general.doubleClickNone' },
  { value: 'copyContent', labelKey: 'settings.general.doubleClickCopyContent' },
];

const SPACE_GROUP_DISPLAY_OPTIONS: { value: SpaceGroupDisplayMode; labelKey: string }[] = [
  { value: 'disabled', labelKey: 'settings.general.spaceGroupDisabled' },
  { value: 'dropdown', labelKey: 'settings.general.spaceGroupDropdown' },
  { value: 'collapse', labelKey: 'settings.general.spaceGroupCollapse' },
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
  const { t, locale, setLocale, locales } = useI18n();
  const isDarkTheme = useStore((s) => s.isDarkTheme);
  const colorThemeId = useStore((s) => s.colorThemeId);
  const showAppBar = useStore((s) => s.showAppBar);
  const hideElementBorders = useStore((s) => s.hideElementBorders);
  const viewMode = useStore((s) => s.viewMode);
  const noteBlockDoubleClickAction = useStore((s) => s.noteBlockDoubleClickAction);
  const spaceGroupDisplayMode = useStore((s) => s.spaceGroupDisplayMode);
  const zoomLevel = useStore((s) => s.zoomLevel);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const setColorTheme = useStore((s) => s.setColorTheme);
  const toggleAppBar = useStore((s) => s.toggleAppBar);
  const toggleHideElementBorders = useStore((s) => s.toggleHideElementBorders);
  const setViewMode = useStore((s) => s.setViewMode);
  const setNoteBlockDoubleClickAction = useStore((s) => s.setNoteBlockDoubleClickAction);
  const setSpaceGroupDisplayMode = useStore((s) => s.setSpaceGroupDisplayMode);
  const zoomIn = useStore((s) => s.zoomIn);
  const zoomOut = useStore((s) => s.zoomOut);
  const resetZoom = useStore((s) => s.resetZoom);

  const currentTheme = COLOR_THEMES.find((theme) => theme.id === colorThemeId) ?? COLOR_THEMES[0];

  return (
    <div className="settings-panel">
      <h4 className="settings-panel-title">{t('settings.general.panelTitle')}</h4>

      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">{t('settings.general.displayLanguage')}</span>
          <span className="settings-row-desc">{t('settings.general.displayLanguageDesc')}</span>
        </div>
        <select
          className="settings-select"
          value={locale}
          onChange={(e) => setLocale(e.target.value as AppLocale)}
        >
          {locales.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">{t('settings.general.colorTheme')}</span>
          <span className="settings-row-desc">{t(`settings.themes.${currentTheme.id}.description`)}</span>
        </div>
        <select
          className="settings-select"
          value={colorThemeId}
          onChange={(e) => setColorTheme(e.target.value as ColorThemeId)}
        >
          {COLOR_THEMES.map((theme) => (
            <option key={theme.id} value={theme.id}>{t(`settings.themes.${theme.id}.label`)}</option>
          ))}
        </select>
      </div>

      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">{t('settings.general.darkMode')}</span>
          <span className="settings-row-desc">{t('settings.general.darkModeDesc')}</span>
        </div>
        <SettingsToggle checked={isDarkTheme} onChange={toggleTheme} />
      </div>

      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">{t('settings.general.showAppBar')}</span>
          <span className="settings-row-desc">{t('settings.general.showAppBarDesc')}</span>
        </div>
        <SettingsToggle checked={showAppBar} onChange={toggleAppBar} />
      </div>

      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">{t('settings.general.spaceGroupDisplay')}</span>
          <span className="settings-row-desc">{t('settings.general.spaceGroupDisplayDesc')}</span>
        </div>
        <select
          className="settings-select"
          value={spaceGroupDisplayMode}
          onChange={(e) => setSpaceGroupDisplayMode(e.target.value as SpaceGroupDisplayMode)}
        >
          {SPACE_GROUP_DISPLAY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
          ))}
        </select>
      </div>

      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">{t('settings.general.hideBorders')}</span>
          <span className="settings-row-desc">{t('settings.general.hideBordersDesc')}</span>
        </div>
        <SettingsToggle checked={hideElementBorders} onChange={toggleHideElementBorders} />
      </div>

      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">{t('settings.general.defaultView')}</span>
          <span className="settings-row-desc">{t('settings.general.defaultViewDesc')}</span>
        </div>
        <select
          className="settings-select"
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as ViewMode)}
        >
          {VIEW_MODE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
          ))}
        </select>
      </div>

      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">{t('settings.general.noteBlockDoubleClick')}</span>
          <span className="settings-row-desc">{t('settings.general.noteBlockDoubleClickDesc')}</span>
        </div>
        <select
          className="settings-select"
          value={noteBlockDoubleClickAction}
          onChange={(e) => setNoteBlockDoubleClickAction(e.target.value as NoteBlockDoubleClickAction)}
        >
          {NOTE_BLOCK_DOUBLE_CLICK_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
          ))}
        </select>
      </div>

      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">{t('settings.general.zoom')}</span>
          <span className="settings-row-desc">{t('settings.general.zoomDesc')}</span>
        </div>
        <div className="settings-zoom-controls">
          <button type="button" className="btn btn-secondary settings-zoom-btn" onClick={zoomOut}>−</button>
          <span className="settings-zoom-value">{Math.round(zoomLevel * 100)}%</span>
          <button type="button" className="btn btn-secondary settings-zoom-btn" onClick={zoomIn}>+</button>
          <button type="button" className="btn btn-secondary settings-zoom-reset" onClick={resetZoom}>{t('common.reset')}</button>
        </div>
      </div>
    </div>
  );
};

function getModifierKeyLabel(): string {
  if (typeof navigator === 'undefined') return 'Cmd';
  const platform = navigator.userAgent.toLowerCase();
  return /mac|darwin|iphone|ipad|ipod/.test(platform) ? 'Cmd' : 'Ctrl';
}

const SHORTCUT_ITEMS: { key: 'P' | 'I' | 'F' | 'Shift+F' | '1' | '2'; descriptionKey: string }[] = [
  { key: 'P', descriptionKey: 'settings.shortcuts.history' },
  ...(!IS_MAC_APP_STORE ? [{ key: 'I' as const, descriptionKey: 'settings.shortcuts.aiChat' }] : []),
  { key: 'F', descriptionKey: 'settings.shortcuts.workspaceSearch' },
  { key: 'Shift+F', descriptionKey: 'settings.shortcuts.globalSearch' },
  { key: '1', descriptionKey: 'settings.shortcuts.hideSpaceSidebar' },
  { key: '2', descriptionKey: 'settings.shortcuts.hideDirectoryPanel' },
];

function formatShortcut(key: string): string {
  const mod = getModifierKeyLabel();
  return `${mod} + ${key}`;
}

const ShortcutsSettings: React.FC = () => {
  const { t } = useI18n();

  return (
    <div className="settings-panel">
      <div className="settings-panel-head">
        <h4 className="settings-panel-title">{t('settings.shortcuts.panelTitle')}</h4>
        <p className="settings-panel-desc">{t('settings.shortcuts.panelDesc')}</p>
      </div>

      <div className="settings-shortcuts-list">
        {SHORTCUT_ITEMS.map((item) => (
          <div className="settings-shortcut-row" key={item.key}>
            <span className="settings-shortcut-desc">{t(item.descriptionKey)}</span>
            <kbd className="settings-shortcut-key">{formatShortcut(item.key)}</kbd>
          </div>
        ))}
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
}> = ({ label, path, onSelect, selectLabel, compact = false }) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!path) return;
    try {
      await writeText(path);
      setCopied(true);
      showToast(t('settings.path.pathCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        await navigator.clipboard.writeText(path);
        setCopied(true);
        showToast(t('settings.path.pathCopied'));
        setTimeout(() => setCopied(false), 2000);
      } catch {
        showToast(t('settings.path.copyFailed'));
      }
    }
  }, [path]);

  const handleOpen = useCallback(async () => {
    if (!path) return;
    try {
      await revealItemInDir(path);
    } catch (e) {
      console.error('Failed to open path:', e);
      showToast(t('settings.path.openPathFailed'));
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
            title={t('settings.path.copyPath')}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            className="settings-path-btn"
            onClick={handleOpen}
            disabled={!path}
            title={t('settings.path.openInFileManager')}
          >
            <FolderOpen size={14} />
          </button>
        </div>
      </div>
      <div className={`settings-path-value ${!path ? 'empty' : ''}`}>
        {path || t('settings.path.notSet')}
      </div>
      {!path && onSelect && (
        <button type="button" className="btn btn-secondary settings-path-select-btn" onClick={onSelect}>
          <HardDrive size={14} />
          {selectLabel ?? t('settings.path.selectDirectory')}
        </button>
      )}
      {path && onSelect && (
        <button type="button" className="settings-path-change-btn" onClick={onSelect}>
          {t('settings.path.changeDirectory')}
        </button>
      )}
    </div>
  );
};

const BackupSettings: React.FC = () => {
  const { t } = useI18n();
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
    getConfigFilePath(storagePath).then(setConfigPath).catch((e) => {
      console.error('Failed to get config path:', e);
    });
  }, [refreshStats, storagePath]);

  const handleSelectBackupDir = useCallback(async () => {
    const selected = await selectBackupDir();
    if (!selected) return;
    try {
      await saveBackupDir(selected);
      setBackupDir(selected);
      await refreshStats(selected);
      showToast(t('settings.backup.backupDirUpdated'));
    } catch (e) {
      console.error('Failed to save backup dir:', e);
      showToast(t('settings.backup.backupDirSaveFailed'));
    }
  }, [refreshStats]);

  const handleBackup = useCallback(async () => {
    if (!backupDir || !configPath || backingUp) return;
    setBackingUp(true);
    try {
      const filename = await createBackup(backupDir, storagePath, configPath);
      await refreshStats(backupDir);
      showToast(t('settings.backup.completed', { filename }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('settings.backup.failed');
      console.error('Backup failed:', e);
      showToast(msg);
    } finally {
      setBackingUp(false);
    }
  }, [backupDir, configPath, storagePath, backingUp, refreshStats]);

  return (
    <div className="settings-panel settings-panel--compact">
      <div className="settings-panel-head">
        <h4 className="settings-panel-title">{t('settings.backup.panelTitle')}</h4>
        <p className="settings-panel-desc">{t('settings.backup.panelDesc')}</p>
      </div>

      <PathItem
        label={t('settings.backup.backupDir')}
        path={backupDir}
        onSelect={handleSelectBackupDir}
        compact
      />

      <div className="settings-backup-summary">
        <span>{t('settings.backup.summaryCount', { count: stats?.count ?? 0 })}</span>
        <span className="settings-backup-summary-sep">·</span>
        <span>{stats?.latestTimeDisplay ? t('settings.backup.latest', { time: stats.latestTimeDisplay }) : t('settings.backup.latestNone')}</span>
      </div>

      <div className="settings-backup-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleBackup}
          disabled={!backupDir || backingUp}
        >
          {backingUp ? <Loader2 size={13} className="settings-spin" /> : <Archive size={13} />}
          {backingUp ? t('settings.backup.backingUp') : t('settings.backup.backupNow')}
        </button>
        {!backupDir && (
          <span className="settings-backup-hint">{t('settings.backup.selectBackupDirFirst')}</span>
        )}
      </div>

      <div className="settings-backup-list">
        <div className="settings-backup-list-header">
          <span>{t('settings.backup.backupFiles')}</span>
          {(stats?.files.length ?? 0) > 0 && (
            <span className="settings-backup-list-count">{stats?.files.length}</span>
          )}
        </div>
        {!backupDir ? (
          <div className="settings-backup-list-empty">{t('settings.backup.showAfterSelect')}</div>
        ) : (stats?.files.length ?? 0) === 0 ? (
          <div className="settings-backup-list-empty">{t('settings.backup.noBackupFiles')}</div>
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

const SyncSettingsGate: React.FC<{ onGoToPro: () => void }> = ({ onGoToPro }) => {
  const { t } = useI18n();
  const isPro = useLicenseStore((s) => s.isPro);

  if (isPro) return <SyncSettings />;

  return (
    <div className="settings-panel">
      <h4 className="settings-panel-title">{t('settings.sync.panelTitle')}</h4>
      <div className="pro-locked-panel">
        <p className="pro-locked-title">{t('pro.gate.sync')}</p>
        {IS_MAC_APP_STORE ? (
          <div className="pro-locked-store">
            <AppStorePurchaseControls />
          </div>
        ) : (
          <>
            <p className="pro-locked-desc">{t('pro.gate.hint')}</p>
            <div className="pro-locked-actions">
              <button type="button" className="btn btn-secondary" onClick={onGoToPro}>
                <KeyRound size={14} />
                {t('pro.gate.activate')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    await openUrl(PURCHASE_URL);
                  } catch {
                    showToast(t('pro.errors.openPurchaseFailed'));
                  }
                }}
              >
                <ExternalLink size={14} />
                {t('pro.gate.purchase')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

function mapLicenseError(code: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (code === 'EMPTY_KEY') return t('pro.errors.emptyKey');
  if (code === 'NETWORK') return t('pro.errors.network');
  if (/activation/i.test(code) || /limit/i.test(code)) return t('pro.errors.activationLimit');
  if (/invalid/i.test(code) || /not.?found/i.test(code) || /422/.test(code)) return t('pro.errors.invalidKey');
  return t('pro.errors.activateFailed', { detail: code });
}

const LicenseSettings: React.FC = () => {
  const { t } = useI18n();
  const isPro = useLicenseStore((s) => s.isPro);
  const license = useLicenseStore((s) => s.license);
  const busy = useLicenseStore((s) => s.busy);
  const error = useLicenseStore((s) => s.error);
  const activate = useLicenseStore((s) => s.activate);
  const deactivate = useLicenseStore((s) => s.deactivate);
  const clearError = useLicenseStore((s) => s.clearError);
  const [licenseKey, setLicenseKey] = useState('');

  if (IS_MAC_APP_STORE) {
    return <AppStorePurchaseControls />;
  }

  const handleActivate = async () => {
    const ok = await activate(licenseKey);
    if (ok) {
      setLicenseKey('');
      showToast(t('pro.activated'));
    }
  };

  const handleDeactivate = async () => {
    const ok = await deactivate();
    if (ok) showToast(t('pro.deactivated'));
  };

  const handlePurchase = async () => {
    try {
      await openUrl(PURCHASE_URL);
    } catch {
      showToast(t('pro.errors.openPurchaseFailed'));
    }
  };

  return (
    <div className="settings-row settings-row-vertical">
      <div className="settings-row-info">
        <span className="settings-row-label">{t('pro.license')}</span>
        <span className={`pro-plan-status ${isPro ? 'is-pro' : 'is-free'}`}>
          {isPro && <Crown size={15} strokeWidth={2.25} className="pro-plan-crown" />}
          <span className="pro-plan-name">{isPro ? t('pro.badge') : t('pro.planFree')}</span>
        </span>
        {!isPro && (
          <span className="settings-row-desc">{t('pro.statusFree')}</span>
        )}
      </div>
      {isPro ? (
        <div className="pro-settings-active">
          <div className="pro-active-meta">
            <div className="pro-active-meta-row">
              <span className="pro-active-meta-label">{t('pro.licenseKey')}</span>
              <code className="pro-license-mask" title={license?.licenseKey}>
                {license?.licenseKey
                  ? `${license.licenseKey.slice(0, 8)}…${license.licenseKey.slice(-4)}`
                  : t('pro.badge')}
              </code>
            </div>
            <div className="pro-active-meta-row">
              <span className="pro-active-meta-label">{t('pro.validity')}</span>
              <span className="pro-active-meta-value">{t('pro.validityPermanent')}</span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary pro-revoke-btn"
            onClick={() => void handleDeactivate()}
            disabled={busy}
          >
            {busy ? <Loader2 size={14} className="settings-spin" /> : null}
            {t('pro.deactivate')}
          </button>
        </div>
      ) : (
        <div className="pro-settings-activate">
          <input
            className="pro-activate-input"
            value={licenseKey}
            onChange={(e) => {
              clearError();
              setLicenseKey(e.target.value);
            }}
            placeholder={t('pro.licenseKeyPlaceholder')}
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleActivate();
            }}
          />
          <div className="settings-update-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleActivate()}
              disabled={busy || !licenseKey.trim()}
            >
              {busy ? <Loader2 size={14} className="settings-spin" /> : <KeyRound size={14} />}
              {busy ? t('pro.activating') : t('pro.gate.activate')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => void handlePurchase()}>
              <ExternalLink size={14} />
              {t('pro.gate.purchase')}
            </button>
          </div>
          {error && <p className="pro-activate-error">{mapLicenseError(error, t)}</p>}
        </div>
      )}
    </div>
  );
};

const ProSettings: React.FC = () => {
  const { t } = useI18n();

  return (
    <div className="settings-panel">
      <div className="settings-panel-head">
        <h4 className="settings-panel-title">{t('settings.pro.panelTitle')}</h4>
        <p className="settings-panel-desc">{t('settings.pro.panelDesc')}</p>
      </div>
      <LicenseSettings />
    </div>
  );
};

const FeedbackSettings: React.FC = () => {
  const { t } = useI18n();
  const [version, setVersion] = useState('');
  const [copiedInfo, setCopiedInfo] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    getAppVersion().then(setVersion);
  }, []);

  const diagnosticInfo = buildDiagnosticInfo(version);

  const handleCopyInfo = useCallback(async () => {
    const ok = await copyTextToClipboard(diagnosticInfo);
    if (!ok) {
      showToast(t('settings.path.copyFailed'));
      return;
    }
    setCopiedInfo(true);
    showToast(t('settings.feedback.infoCopied'));
    setTimeout(() => setCopiedInfo(false), 2000);
  }, [diagnosticInfo, t]);

  const handleCopyEmail = useCallback(async () => {
    const ok = await copyTextToClipboard(FEEDBACK_EMAIL);
    if (!ok) {
      showToast(t('settings.path.copyFailed'));
      return;
    }
    setCopiedEmail(true);
    showToast(t('settings.feedback.emailCopied'));
    setTimeout(() => setCopiedEmail(false), 2000);
  }, [t]);

  const handleOpenMail = useCallback(async () => {
    const subject = encodeURIComponent(t('settings.feedback.mailSubject'));
    const body = encodeURIComponent(`${t('settings.feedback.mailBodyHint')}\n\n---\n${diagnosticInfo}\n`);
    try {
      await openUrl(`mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`);
    } catch {
      showToast(t('settings.feedback.openMailFailed'));
    }
  }, [diagnosticInfo, t]);

  return (
    <div className="settings-panel">
      <div className="settings-panel-head">
        <h4 className="settings-panel-title">{t('settings.feedback.panelTitle')}</h4>
        <p className="settings-panel-desc">{t('settings.feedback.panelDesc')}</p>
      </div>

      <div className="settings-row settings-row-vertical">
        <div className="settings-row-info">
          <span className="settings-row-label">{t('settings.feedback.email')}</span>
          <span className="settings-row-desc">{t('settings.feedback.emailDesc')}</span>
        </div>
        <button type="button" className="settings-link" onClick={() => void handleOpenMail()}>
          {FEEDBACK_EMAIL}
          <Mail size={14} />
        </button>
        <div className="settings-update-actions">
          <button type="button" className="btn btn-primary" onClick={() => void handleOpenMail()}>
            <Mail size={14} />
            {t('settings.feedback.writeEmail')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void handleCopyEmail()}>
            {copiedEmail ? <Check size={14} /> : <Copy size={14} />}
            {copiedEmail ? t('settings.feedback.copied') : t('settings.feedback.copyEmail')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void handleCopyInfo()}>
            {copiedInfo ? <Check size={14} /> : <Copy size={14} />}
            {copiedInfo ? t('settings.feedback.copied') : t('settings.feedback.copyInfo')}
          </button>
        </div>
        <p className="settings-feedback-hint">{t('settings.feedback.bugHint')}</p>
      </div>
    </div>
  );
};

const DataSettings: React.FC = () => {
  const { t } = useI18n();
  const storagePath = useStore((s) => s.storagePath);
  const [configPath, setConfigPath] = useState<string | null>(null);
  const [workspacesPath, setWorkspacesPath] = useState<string | null>(null);
  const [appDir, setAppDir] = useState<string | null>(null);

  useEffect(() => {
    getConfigFilePath(storagePath).then(setConfigPath).catch((e) => {
      console.error('Failed to get config path:', e);
    });
    getWorkspacesFilePath().then(setWorkspacesPath).catch((e) => {
      console.error('Failed to get workspaces path:', e);
    });
    getAppDirectory().then(setAppDir).catch((e) => {
      console.error('Failed to get app directory:', e);
    });
  }, [storagePath]);

  return (
    <div className="settings-panel">
      <h4 className="settings-panel-title">{t('settings.data.panelTitle')}</h4>
      <p className="settings-panel-desc">{t('settings.data.panelDesc')}</p>

      <PathItem label={t('settings.data.workspacesRegistry')} path={workspacesPath} />
      <PathItem label={t('settings.data.currentWorkspaceConfig')} path={configPath} />
      <PathItem label={t('settings.data.currentStorageDir')} path={storagePath} />
      <PathItem label={t('settings.data.currentAppDir')} path={appDir} />
    </div>
  );
};

const SampleLibrarySettings: React.FC = () => {
  const { t } = useI18n();
  const storagePath = useStore((s) => s.storagePath);
  const [showSampleLibrary, setShowSampleLibrary] = useState(false);

  return (
    <div className="settings-panel">
      <div className="settings-panel-head">
        <h4 className="settings-panel-title">{t('settings.sampleLibrary.panelTitle')}</h4>
        <p className="settings-panel-desc">{t('settings.sampleLibrary.panelDesc')}</p>
      </div>

      <div className="settings-sample-library-card">
        <div className="settings-row-info">
          <span className="settings-row-label">{t('settings.sampleLibrary.importLabel')}</span>
          <span className="settings-row-desc">{t('settings.sampleLibrary.importDesc')}</span>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setShowSampleLibrary(true)}
          disabled={!storagePath}
        >
          <Download size={14} />
          {t('settings.sampleLibrary.importAction')}
        </button>
      </div>

      <OfficialSampleLibraryModal
        open={showSampleLibrary}
        onClose={() => setShowSampleLibrary(false)}
      />
    </div>
  );
};

const AboutSettings: React.FC = () => {
  const { t } = useI18n();
  const [version, setVersion] = useState('');
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checkMessage, setCheckMessage] = useState('');

  useEffect(() => {
    getAppVersion().then(setVersion);
  }, []);

  const handleCheckUpdate = useCallback(async () => {
    flushSync(() => {
      setChecking(true);
      setCheckMessage('');
      setUpdateInfo(null);
    });
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    try {
      if (await checkWithNativeUpdater()) {
        setCheckMessage(t('settings.about.sparkleOpened'));
        return;
      }
      const info = await checkForUpdate();
      if (info) {
        setUpdateInfo(info);
        setCheckMessage(t('settings.about.newVersion', { version: info.latestVersion }));
      } else {
        setCheckMessage(t('settings.about.latestVersion'));
      }
    } catch (e) {
      const msg = formatUpdateError(e, t('settings.about.checkFailed'));
      setCheckMessage(msg);
      showToast(msg);
    } finally {
      setChecking(false);
    }
  }, [t]);

  const handleDownloadUpdate = useCallback(async () => {
    if (!updateInfo) return;
    setDownloading(true);
    try {
      await downloadAndInstall(updateInfo.asset);
      showToast(t('settings.about.installerStarted'));
    } catch (e) {
      const msg = formatUpdateError(e, t('settings.about.downloadFailed'));
      showToast(msg);
      setCheckMessage(msg);
    } finally {
      setDownloading(false);
    }
  }, [updateInfo, t]);

  const handleOpenExternal = useCallback(async (url: string, failKey: string) => {
    try {
      await openUrl(url);
    } catch (e) {
      console.error(`Failed to open ${url}:`, e);
      showToast(t(failKey));
    }
  }, [t]);

  return (
    <div className="settings-panel">
      <h4 className="settings-panel-title">{t('settings.about.panelTitle')}</h4>

      <div className="settings-about-card" aria-busy={checking || downloading}>
        <div className="settings-about-logo">📝</div>
        <div className="settings-about-info">
          <div className="settings-about-name">TinyNote</div>
          <div className="settings-about-version-row">
            <div className="settings-about-version">{t('settings.about.version', { version: version || '...' })}</div>
            {!IS_MAC_APP_STORE && <button
              type="button"
              className={`settings-about-check${checking ? ' is-loading' : ''}`}
              onClick={(event) => {
                event.currentTarget.querySelector('svg')?.classList.add('settings-spin');
                void handleCheckUpdate();
              }}
              disabled={checking || downloading}
              aria-busy={checking}
            >
              <RefreshCw size={13} className={checking ? 'settings-spin' : undefined} />
              {checking ? t('settings.about.checking') : t('settings.about.checkUpdate')}
            </button>}
          </div>
          <div className="settings-about-desc">{t('utils.app.description')}</div>
        </div>
      </div>

      {!IS_MAC_APP_STORE && <div className="settings-about-update">
        {updateInfo && (
          <div className="settings-update-actions">
            <button
              type="button"
              className={`btn btn-primary${downloading ? ' is-loading' : ''}`}
              onClick={handleDownloadUpdate}
              disabled={downloading}
              aria-busy={downloading}
            >
              {downloading ? <Loader2 size={14} className="settings-spin" /> : <Download size={14} />}
              {downloading ? t('settings.about.downloading') : t('settings.about.downloadAndUpdate')}
            </button>
          </div>
        )}
        {(checking || downloading) && (
          <div className="settings-update-loading" role="status" aria-live="polite">
            <Loader2 size={16} className="settings-spin" />
            <span>
              {checking ? t('settings.about.checkingHint') : t('settings.about.downloadingHint')}
            </span>
            <span className="settings-update-progress" aria-hidden="true" />
          </div>
        )}
        {checkMessage && !checking && !downloading && (
          <p className={`settings-update-message ${updateInfo ? 'has-update' : ''}`}>
            {checkMessage}
          </p>
        )}
      </div>}

      <div className="settings-row settings-row-vertical">
        <div className="settings-row-info">
          <span className="settings-row-label">{t('settings.about.projectAuthor')}</span>
          <button
            type="button"
            className="settings-link"
            onClick={() => void handleOpenExternal(AUTHOR_URL, 'settings.about.openAuthorFailed')}
          >
            {AUTHOR_NAME}
            <ExternalLink size={14} />
          </button>
          <span className="settings-row-desc">{AUTHOR_URL}</span>
        </div>
      </div>

      <div className="settings-row settings-row-vertical">
        <div className="settings-row-info">
          <span className="settings-row-label">{t('settings.about.projectHome')}</span>
          <button
            type="button"
            className="settings-link"
            onClick={() => void handleOpenExternal(HOMEPAGE_URL, 'settings.about.openHomepageFailed')}
          >
            {HOMEPAGE_URL}
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      <div className="settings-row settings-row-vertical">
        <div className="settings-row-info">
          <span className="settings-row-label">{t('settings.about.helpCenter')}</span>
          <button
            type="button"
            className="settings-link"
            onClick={() => void handleOpenExternal(DOCS_URL, 'settings.about.openHelpCenterFailed')}
          >
            {DOCS_URL}
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      {!IS_MAC_APP_STORE && <div className="settings-row settings-row-vertical">
        <div className="settings-row-info">
          <span className="settings-row-label">{t('settings.about.downloadPages')}</span>
          <span className="settings-row-desc">{t('settings.about.downloadPagesDesc')}</span>
        </div>
        <div className="settings-about-downloads">
          <div className="settings-about-download-item">
            <span className="settings-row-label">{t('settings.about.officialDownload')}</span>
            <button
              type="button"
              className="settings-link"
              onClick={() => void handleOpenExternal(DOWNLOAD_PAGE_URL, 'settings.about.openOfficialDownloadFailed')}
            >
              {DOWNLOAD_PAGE_URL}
              <ExternalLink size={14} />
            </button>
          </div>
          <div className="settings-about-download-item">
            <span className="settings-row-label">{t('settings.about.githubDownload')}</span>
            <button
              type="button"
              className="settings-link"
              onClick={() => void handleOpenExternal(GITHUB_RELEASES_URL, 'settings.about.openReleaseFailed')}
            >
              {GITHUB_RELEASES_URL}
              <ExternalLink size={14} />
            </button>
          </div>
          <div className="settings-about-download-item">
            <span className="settings-row-label">{t('settings.about.mirrorDownload')}</span>
            <button
              type="button"
              className="settings-link"
              onClick={() => void handleOpenExternal(MIRROR_DOWNLOAD_URL, 'settings.about.openMirrorFailed')}
            >
              {MIRROR_DOWNLOAD_URL}
              <ExternalLink size={14} />
            </button>
          </div>
        </div>
      </div>}

    </div>
  );
};

const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  const { t } = useI18n();
  const [activeModule, setActiveModule] = useState<SettingsModule>('general');

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h3 className="modal-title">{t('settings.title')}</h3>
          <button type="button" className="icon-btn" onClick={onClose} title={t('common.close')}>
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
                <span>{t(`settings.modules.${mod.id}`)}</span>
              </button>
            ))}
          </nav>

          <div className="settings-content">
            {activeModule === 'general' && <GeneralSettings />}
            {!IS_MAC_APP_STORE && activeModule === 'ai' && <AISettings />}
            {activeModule === 'data' && <DataSettings />}
            {activeModule === 'sampleLibrary' && <SampleLibrarySettings />}
            {activeModule === 'sync' && <SyncSettingsGate onGoToPro={() => setActiveModule('pro')} />}
            {activeModule === 'backup' && <BackupSettings />}
            {activeModule === 'shortcuts' && <ShortcutsSettings />}
            {activeModule === 'pro' && <ProSettings />}
            {activeModule === 'feedback' && <FeedbackSettings />}
            {activeModule === 'about' && <AboutSettings />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
