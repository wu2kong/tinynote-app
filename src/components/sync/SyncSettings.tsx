import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowDownToLine, Check, Cloud, Copy, FolderOpen, GitBranch, KeyRound, Loader2,
  Minus, Plus, RefreshCw, Star, Upload,
} from 'lucide-react';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useStore } from '@/store/useStore';
import {
  formatSyncCommitMessage, formatSyncError, getChangeBadge, getChangeTooltip,
  getFileDiff, getGitStatus, gitPull, gitSyncPush, revertFileChange,
  type FileDiff, type GitChangedFile, type GitSyncStatus,
} from '@/utils/sync';
import { joinPath, normalizePath } from '@/utils/path';
import * as fs from '@/utils/fileSystem';
import { loadConfig, saveConfig } from '@/utils/config';
import { getSyncBackend, isWeb } from '@/platform/detect';
import { promptAndOpenWorkspaceInCurrentWindow } from '@/utils/workspaceActions';
import ConfirmModal from '@/components/ConfirmModal';
import { showToast } from '@/components/Toast';
import { useI18n } from '@/i18n/useI18n';
import type { GitRemoteConfig, SyncMode } from '@/utils/configTypes';
import { GIT_PROVIDERS, type GitRemoteProvider } from '@/adapters/sync/gitProviders';
import {
  addGitRemotePlaceholder, buildAuthByRemote, disconnectGitRemote, enabledRemoteNames,
  hydrateGitRemotesFromRepo,
} from '@/utils/gitSyncSetup';
import SyncDiffModal from './SyncDiffModal';
import GitRemoteSetupModal from './GitRemoteSetupModal';

function remoteListLabel(remote: GitRemoteConfig, t: (key: string) => string): string {
  if (remote.provider !== 'custom') {
    return t(`settings.sync.providers.${remote.provider}`);
  }
  if (!remote.url) return t('settings.sync.providers.custom');
  try {
    const host = new URL(remote.url.replace(/^git@/, 'https://').replace(':', '/')).host;
    return host || t('settings.sync.providers.custom');
  } catch {
    return t('settings.sync.providers.custom');
  }
}

function isRemoteAuthorized(remote: GitRemoteConfig, authorizedNames: string[]): boolean {
  if (authorizedNames.includes(remote.name)) return true;
  return Boolean(remote.url) && /^(git@|ssh:\/\/)/i.test(remote.url);
}

type CloudFolderMode = 'icloud' | 'onedrive' | 'dropbox' | 'nutstore' | 'baidu' | 'webdav' | 'local';

function detectCloudFolderMode(storagePath: string | null): CloudFolderMode {
  if (!storagePath) return 'local';
  const path = normalizePath(storagePath).toLowerCase();
  if (path.includes('com~apple~clouddocs') || path.includes('icloud drive')) return 'icloud';
  if (/(^|\/)onedrive(?:[\s._-]|\/|$)/.test(path)) return 'onedrive';
  if (/(^|\/)dropbox(?:\/|$)/.test(path)) return 'dropbox';
  if (path.includes('nutstore') || path.includes('坚果云')) return 'nutstore';
  if (path.includes('baidunetdisk') || path.includes('baidu cloud') || path.includes('百度网盘') || path.includes('百度云')) return 'baidu';
  if (path.includes('webdav') || path.includes('web-dav') || path.includes('davfs')) return 'webdav';
  return 'local';
}

const SyncSettings: React.FC = () => {
  const { t } = useI18n();
  const storagePath = useStore((s) => s.storagePath);
  const [syncMode, setSyncMode] = useState<SyncMode>('none');
  const [remotes, setRemotes] = useState<GitRemoteConfig[]>([]);
  const [primaryRemote, setPrimaryRemote] = useState<string | null>(null);
  const [authorizedNames, setAuthorizedNames] = useState<string[]>([]);
  const [status, setStatus] = useState<GitSyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [copiedRemote, setCopiedRemote] = useState<string | null>(null);
  const [diffModal, setDiffModal] = useState<{ open: boolean; file: GitChangedFile | null; data: FileDiff | null; loading: boolean }>({
    open: false,
    file: null,
    data: null,
    loading: false,
  });
  const [revertTarget, setRevertTarget] = useState<GitChangedFile | null>(null);
  const [revertingPath, setRevertingPath] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardProvider, setWizardProvider] = useState<GitRemoteProvider | null>(null);
  const [wizardRemoteName, setWizardRemoteName] = useState<string | null>(null);
  const [reauthRemote, setReauthRemote] = useState<GitRemoteConfig | null>(null);
  const [removeTarget, setRemoveTarget] = useState<GitRemoteConfig | null>(null);
  const [selectedRemoteId, setSelectedRemoteId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [gitCorsProxy, setGitCorsProxy] = useState('https://cors.isomorphic-git.org');
  const [choosingCloudFolder, setChoosingCloudFolder] = useState(false);

  const loadLocalConfig = useCallback(async () => {
    const cfg = await loadConfig();
    setSyncMode(cfg.syncMode ?? 'none');
    setRemotes(cfg.gitRemotes ?? []);
    setPrimaryRemote(cfg.syncPrimaryRemote);
    setAuthorizedNames(Object.keys(cfg.gitRemoteAuth ?? {}).filter((name) => cfg.gitRemoteAuth[name]?.token));
    setGitCorsProxy(cfg.gitCorsProxy || 'https://cors.isomorphic-git.org');
    return cfg;
  }, []);

  const refreshStatus = useCallback(async (options?: { toastOnSuccess?: boolean }) => {
    if (!storagePath) {
      setStatus(null);
      return;
    }
    setLoading(true);
    setSyncError(null);
    try {
      let cfg = await loadLocalConfig();
      if (cfg.syncMode === 'git' || (cfg.gitRemotes?.length ?? 0) > 0) {
        await hydrateGitRemotesFromRepo(storagePath);
        cfg = await loadLocalConfig();
      }
      const remotesWithUrl = cfg.gitRemotes ?? [];
      const statusRemote = remotesWithUrl.find((remote) => remote.name === cfg.syncPrimaryRemote && remote.url)?.name
        ?? remotesWithUrl.find((remote) => remote.url)?.name
        ?? null;
      const result = await getGitStatus(storagePath, statusRemote);
      setStatus(result);
      if (result.isRepo && result.hasRemote && cfg.syncMode === 'none') {
        await saveConfig({ syncMode: 'git' });
        setSyncMode('git');
      }
      if (result.statusError) {
        setSyncError(`${t('settings.sync.readStatusFailed')}: ${result.statusError}`);
      } else if (options?.toastOnSuccess) {
        showToast(t('settings.sync.statusRefreshed'));
      }
    } catch (e) {
      console.error('Failed to load git status:', e);
      const msg = e instanceof Error ? e.message : t('settings.sync.readStatusFailed');
      setStatus(null);
      setSyncError(msg);
      showToast(msg);
    } finally {
      setLoading(false);
    }
  }, [loadLocalConfig, storagePath, t]);

  useEffect(() => {
    loadLocalConfig();
  }, [loadLocalConfig]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (remotes.length === 0) {
      setSelectedRemoteId(null);
      return;
    }
    if (!selectedRemoteId || !remotes.some((remote) => remote.id === selectedRemoteId)) {
      setSelectedRemoteId(remotes[0].id);
    }
  }, [remotes, selectedRemoteId]);

  useEffect(() => {
    if (!addMenuOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (addMenuRef.current?.contains(event.target as Node)) return;
      setAddMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [addMenuOpen]);

  const handleChooseMode = useCallback(async (mode: SyncMode) => {
    await saveConfig({ syncMode: mode });
    setSyncMode(mode);
  }, []);

  const handleChooseCloudFolder = useCallback(async () => {
    if (choosingCloudFolder) return;
    setChoosingCloudFolder(true);
    try {
      await promptAndOpenWorkspaceInCurrentWindow({ syncMode: 'cloud' });
    } catch (e) {
      console.error('Failed to choose cloud drive folder:', e);
      showToast(e instanceof Error ? e.message : t('settings.sync.cloudFolderSelectFailed'));
    } finally {
      setChoosingCloudFolder(false);
    }
  }, [choosingCloudFolder, t]);

  const handleCopy = useCallback(async (value: string, key: string) => {
    try {
      await writeText(value);
    } catch {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        showToast(t('settings.path.copyFailed'));
        return;
      }
    }
    setCopiedRemote(key);
    showToast(t('settings.sync.remoteCopied'));
    setTimeout(() => setCopiedRemote(null), 2000);
  }, [t]);

  const handleOpenRepo = useCallback(async () => {
    if (!storagePath) return;
    try {
      await revealItemInDir(storagePath);
    } catch (e) {
      console.error('Failed to open repo path:', e);
      showToast(t('settings.path.openPathFailed'));
    }
  }, [storagePath, t]);

  const handleSetPrimary = useCallback(async (name: string) => {
    await saveConfig({ syncPrimaryRemote: name });
    setPrimaryRemote(name);
    showToast(t('settings.sync.primaryUpdated'));
    await refreshStatus();
  }, [refreshStatus, t]);

  const handleAddSource = useCallback(async (provider: GitRemoteProvider) => {
    setAddMenuOpen(false);
    const meta = GIT_PROVIDERS.find((item) => item.id === provider);
    if (meta?.comingSoon) {
      showToast(t('settings.sync.wizard.tinynoteSoon'));
      return;
    }
    try {
      const remote = await addGitRemotePlaceholder(provider);
      await loadLocalConfig();
      setSelectedRemoteId(remote.id);
      if (remote.url) return;
      setWizardProvider(provider);
      setWizardRemoteName(remote.name);
      setReauthRemote(null);
      setWizardOpen(true);
    } catch (e) {
      showToast(formatSyncError(e, t('settings.sync.addFailed')));
    }
  }, [loadLocalConfig, t]);

  const handleRemoveSelected = useCallback(() => {
    const remote = remotes.find((item) => item.id === selectedRemoteId);
    if (remote) setRemoveTarget(remote);
  }, [remotes, selectedRemoteId]);

  const handleRemoveRemote = useCallback(async (remote: GitRemoteConfig) => {
    if (!storagePath) return;
    try {
      await disconnectGitRemote(storagePath, remote.name);
      showToast(t('settings.sync.remoteRemoved', { name: t(`settings.sync.providers.${remote.provider}`) }));
      await loadLocalConfig();
      await refreshStatus();
    } catch (e) {
      showToast(formatSyncError(e, t('settings.sync.removeFailed')));
    }
  }, [loadLocalConfig, refreshStatus, storagePath, t]);

  const handlePull = useCallback(async () => {
    if (!storagePath || pulling) return;
    const cfg = await loadConfig();
    const remote = cfg.syncPrimaryRemote || enabledRemoteNames(cfg)[0];
    if (!remote) {
      showToast(t('settings.sync.addRemoteFirst'));
      return;
    }
    flushSync(() => {
      setPulling(true);
      setSyncError(null);
    });
    try {
      await gitPull(storagePath, {
        remote,
        auth: buildAuthByRemote(cfg)[remote] ?? null,
      });
      showToast(t('settings.sync.pullComplete'));
      await useStore.getState().reloadSpaces();
      await refreshStatus();
    } catch (e) {
      const msg = formatSyncError(e, t('settings.sync.pullFailed'));
      setSyncError(`${msg}\n\n${t('settings.sync.conflictHint')}`);
      showToast(msg);
    } finally {
      setPulling(false);
    }
  }, [pulling, refreshStatus, storagePath, t]);

  const handlePush = useCallback(async () => {
    if (!storagePath || pushing) return;
    const cfg = await loadConfig();
    const names = enabledRemoteNames(cfg);
    if (names.length === 0) {
      showToast(t('settings.sync.addRemoteFirst'));
      return;
    }
    flushSync(() => {
      setPushing(true);
      setSyncError(null);
    });
    try {
      const result = await gitSyncPush(storagePath, {
        remotes: names,
        authByRemote: buildAuthByRemote(cfg),
      });
      const failed = result.results.filter((item) => !item.ok);
      const okCount = result.results.filter((item) => item.ok).length;
      if (failed.length === 0) {
        showToast(t('settings.sync.pushed', { message: result.message }));
      } else if (okCount > 0) {
        const detail = failed.map((item) => `${item.remote}: ${item.error ?? ''}`).join('\n');
        setSyncError(detail);
        showToast(t('settings.sync.pushPartial', { ok: okCount, fail: failed.length }));
      } else {
        throw new Error(failed[0]?.error || t('settings.sync.pushFailed'));
      }
      await refreshStatus();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('settings.sync.pushFailed');
      if (msg === t('utils.sync.nothingToCommit')) {
        showToast(t('settings.sync.noChanges'));
        return;
      }
      const friendlyMsg = formatSyncError(e, t('settings.sync.pushFailed'));
      setSyncError(`${friendlyMsg}\n\n${t('settings.sync.authFailedHint')}`);
      showToast(friendlyMsg);
    } finally {
      setPushing(false);
    }
  }, [pushing, refreshStatus, storagePath, t]);

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
      const msg = e instanceof Error ? e.message : t('settings.sync.readDiffFailed');
      showToast(msg);
      setDiffModal({ open: false, file: null, data: null, loading: false });
    }
  }, [storagePath, t]);

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
      showToast(t('settings.sync.reverted', { path: file.path }));
      await refreshStatus();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('settings.sync.revertFailed');
      setSyncError(`${t('settings.sync.revertFailed')}: ${msg}`);
      showToast(msg);
    } finally {
      setRevertingPath(null);
      setRevertTarget(null);
    }
  }, [refreshStatus, reloadOpenNotebookIfNeeded, revertingPath, storagePath, t]);

  const handleSaveCors = useCallback(async () => {
    await saveConfig({ gitCorsProxy: gitCorsProxy.trim() || 'https://cors.isomorphic-git.org' });
    showToast(t('settings.sync.configSaved'));
  }, [gitCorsProxy, t]);

  const commitPreview = status ? formatSyncCommitMessage(status.hostname) : '';
  const busy = pulling || pushing;
  const usesSystemGit = getSyncBackend() === 'tauri-rust';
  const enabledCount = remotes.filter((remote) => remote.enabled !== false && remote.url).length;
  const selectedRemote = remotes.find((remote) => remote.id === selectedRemoteId) ?? null;
  const usedKnownProviders = new Set(
    remotes.filter((remote) => remote.provider !== 'custom').map((remote) => remote.provider),
  );
  const cloudFolderMode = useMemo(() => detectCloudFolderMode(storagePath), [storagePath]);
  const addableProviders = GIT_PROVIDERS.filter(
    (item) => item.id === 'custom' || !usedKnownProviders.has(item.id),
  );

  const modeCards = useMemo(() => (
    <div className="settings-sync-mode-grid">
      <button
        type="button"
        className={`settings-sync-mode-card ${syncMode === 'cloud' ? 'is-active' : ''}`}
        onClick={() => handleChooseMode('cloud')}
      >
        <span className="settings-sync-mode-card-head">
          <Cloud size={18} />
          <span className="settings-sync-mode-tag is-basic">{t('settings.sync.modeCloudRecommend')}</span>
        </span>
        <span className="settings-sync-mode-title">{t('settings.sync.modeCloudTitle')}</span>
        <span className="settings-sync-mode-desc">{t('settings.sync.modeCloudDesc')}</span>
      </button>
      <button
        type="button"
        className={`settings-sync-mode-card ${syncMode === 'git' ? 'is-active' : ''}`}
        onClick={() => handleChooseMode('git')}
      >
        <span className="settings-sync-mode-card-head">
          <GitBranch size={18} />
          <span className="settings-sync-mode-tag is-pro">{t('settings.sync.modeGitRecommend')}</span>
        </span>
        <span className="settings-sync-mode-title">{t('settings.sync.modeGitTitle')}</span>
        <span className="settings-sync-mode-desc">{t('settings.sync.modeGitDesc')}</span>
      </button>
    </div>
  ), [handleChooseMode, syncMode, t]);

  return (
    <div className="settings-panel settings-panel--compact settings-panel--fill">
      <div className="settings-panel-head">
        <div className="settings-panel-head-row">
          <div>
            <h4 className="settings-panel-title">{t('settings.sync.panelTitle')}</h4>
            {syncMode !== 'git' && (
              <p className="settings-panel-desc">{t('settings.sync.panelDesc')}</p>
            )}
          </div>
          {syncMode === 'git' && (
            <div className="settings-panel-head-actions">
              <button
                type="button"
                className="settings-sync-change-mode"
                onClick={() => handleChooseMode('none')}
              >
                {t('settings.sync.changeMode')}
              </button>
              <button
                type="button"
                className="settings-path-btn"
                onClick={() => refreshStatus({ toastOnSuccess: true })}
                disabled={!storagePath || loading || busy}
                title={t('settings.sync.refreshStatus')}
              >
                {loading ? <Loader2 size={14} className="settings-spin" /> : <RefreshCw size={14} />}
              </button>
            </div>
          )}
        </div>
      </div>

      {!storagePath && syncMode !== 'cloud' ? (
        <>
          <p className="settings-sync-choose-hint">{t('settings.sync.setStorageFirst')}</p>
          {modeCards}
        </>
      ) : syncMode === 'none' ? (
        <>
          <p className="settings-sync-choose-hint">{t('settings.sync.chooseModeHint')}</p>
          {modeCards}
        </>
      ) : syncMode === 'cloud' ? (
        <>
          {modeCards}
          <div className="settings-sync-cloud-card">
            <div className="settings-sync-cloud-card-copy">
              <div className="settings-sync-cloud-card-title-row">
                <h5>{t('settings.sync.cloudFolderTitle')}</h5>
                {storagePath && (
                  <>
                    <span className="settings-sync-cloud-mode-prefix">{t('settings.sync.cloudCurrentMode')}</span>
                    <span className="settings-sync-cloud-mode-badge">
                      {t(`settings.sync.cloudMode.${cloudFolderMode}`)}
                    </span>
                  </>
                )}
              </div>
              <p>{t('settings.sync.cloudFolderDesc')}</p>
            </div>
            {storagePath && (
              <div className="settings-sync-info settings-sync-cloud-path">
                <span className="settings-sync-info-label">{t('settings.sync.cloudCurrentFolder')}</span>
                <div className="settings-sync-info-value-row">
                  <span className="settings-sync-remote" title={storagePath}>{storagePath}</span>
                  <button
                    type="button"
                    className="settings-path-btn"
                    onClick={handleOpenRepo}
                    title={t('settings.path.openInFileManager')}
                  >
                    <FolderOpen size={14} />
                  </button>
                </div>
              </div>
            )}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void handleChooseCloudFolder()}
              disabled={choosingCloudFolder}
            >
              {choosingCloudFolder ? <Loader2 size={14} className="settings-spin" /> : <FolderOpen size={14} />}
              {storagePath ? t('settings.sync.cloudChangeFolder') : t('settings.sync.cloudSelectFolder')}
            </button>
            <p className="settings-sync-cloud-hint">{t('settings.sync.cloudFolderHint')}</p>
            <p className="settings-sync-cloud-notice">{t('settings.sync.cloudSyncNotice')}</p>
          </div>
        </>
      ) : (
        <div className="settings-sync-shell">
          <div className="settings-sync-source-nav">
            <div className="settings-sync-source-items">
              {remotes.length === 0 ? (
                <div className="settings-sync-source-empty">{t('settings.sync.sourceListEmpty')}</div>
              ) : (
                remotes.map((remote) => {
                  const authorized = isRemoteAuthorized(remote, authorizedNames);
                  return (
                    <button
                      key={remote.id}
                      type="button"
                      className={`settings-sync-source-item ${selectedRemoteId === remote.id ? 'is-active' : ''}`}
                      onClick={() => setSelectedRemoteId(remote.id)}
                    >
                      <span className="settings-sync-source-item-name">{remoteListLabel(remote, t)}</span>
                      <span className={`settings-sync-source-dot ${authorized ? 'is-ok' : 'is-warn'}`} />
                    </button>
                  );
                })
              )}
            </div>
            <div className="settings-sync-source-toolbar">
              <div className="settings-sync-add-wrap" ref={addMenuRef}>
                <button
                  type="button"
                  className="settings-sync-source-tool"
                  title={t('settings.sync.addRemote')}
                  onClick={() => setAddMenuOpen((open) => !open)}
                >
                  <Plus size={14} />
                </button>
                {addMenuOpen && (
                  <div className="settings-sync-add-menu" onClick={(e) => e.stopPropagation()}>
                    {addableProviders.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="settings-sync-add-menu-item"
                        disabled={item.comingSoon}
                        onClick={() => void handleAddSource(item.id)}
                      >
                        <span>{t(`settings.sync.providers.${item.id}`)}</span>
                        {item.comingSoon && <span className="settings-sync-soon">{t('settings.sync.modeCloudSoon')}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="settings-sync-source-tool"
                title={t('settings.sync.removeRemote')}
                disabled={!selectedRemote}
                onClick={handleRemoveSelected}
              >
                <Minus size={14} />
              </button>
            </div>
          </div>

          <div className="settings-sync-main">
            <div className="settings-sync-main-head">
              <div className="settings-sync-source-detail">
              {!selectedRemote ? (
                <div className="settings-sync-empty">
                  <p>{t('settings.sync.noSourceSelected')}</p>
                  <p className="settings-sync-empty-hint">{t('settings.sync.gitSetupDesc')}</p>
                </div>
              ) : (
                <>
                  <div className="settings-sync-detail-head">
                    <div>
                      <h5 className="settings-sync-detail-title">{remoteListLabel(selectedRemote, t)}</h5>
                      <p className="settings-sync-detail-desc">
                        {t(`settings.sync.wizard.providerDesc.${selectedRemote.provider}`)}
                      </p>
                    </div>
                    <div className="settings-sync-detail-badges">
                      {primaryRemote === selectedRemote.name && selectedRemote.url && (
                        <span className="settings-sync-primary-badge">{t('settings.sync.primaryBadge')}</span>
                      )}
                      <span className={`settings-sync-auth-dot ${isRemoteAuthorized(selectedRemote, authorizedNames) ? 'is-ok' : 'is-warn'}`}>
                        {isRemoteAuthorized(selectedRemote, authorizedNames)
                          ? t('settings.sync.authorized')
                          : t('settings.sync.needAuth')}
                      </span>
                    </div>
                  </div>

                  <div className="settings-sync-info">
                    <div className="settings-sync-info-row">
                      <span className="settings-sync-info-label">{t('settings.sync.remoteRepo')}</span>
                      <div className="settings-sync-info-value-row">
                        <span className="settings-sync-remote" title={selectedRemote.url || undefined}>
                          {selectedRemote.url || t('settings.sync.repoNotConnected')}
                        </span>
                        {selectedRemote.url && (
                          <button
                            type="button"
                            className="settings-path-btn"
                            onClick={() => handleCopy(selectedRemote.url, selectedRemote.name)}
                            title={t('settings.sync.copyRemote')}
                          >
                            {copiedRemote === selectedRemote.name ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="settings-sync-detail-actions">
                    {!selectedRemote.url ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setWizardProvider(selectedRemote.provider);
                          setWizardRemoteName(selectedRemote.name);
                          setReauthRemote(null);
                          setWizardOpen(true);
                        }}
                      >
                        <KeyRound size={13} />
                        {t('settings.sync.connectSource')}
                      </button>
                    ) : (
                      <>
                        {primaryRemote !== selectedRemote.name && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => void handleSetPrimary(selectedRemote.name)}
                          >
                            <Star size={13} />
                            {t('settings.sync.setPrimary')}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setWizardProvider(selectedRemote.provider);
                            setWizardRemoteName(selectedRemote.name);
                            setReauthRemote(selectedRemote);
                            setWizardOpen(true);
                          }}
                        >
                          <KeyRound size={13} />
                          {t('settings.sync.reauthorize')}
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {status?.isRepo && (
              <div className="settings-sync-status">
                <div className="settings-sync-info">
                  <div className="settings-sync-info-row">
                    <span className="settings-sync-info-label">{t('settings.sync.currentRepo')}</span>
                    <div className="settings-sync-info-value-row">
                      <span className="settings-sync-remote" title={storagePath ?? undefined}>{storagePath}</span>
                      <button type="button" className="settings-path-btn" onClick={handleOpenRepo} title={t('settings.path.openInFileManager')}>
                        <FolderOpen size={14} />
                      </button>
                    </div>
                  </div>
                  {status.branch && (
                    <div className="settings-sync-info-row">
                      <span className="settings-sync-info-label">{t('settings.sync.currentBranch', { branch: status.branch })}</span>
                    </div>
                  )}
                </div>

                <div className="settings-backup-summary settings-sync-summary">
                  <span>{t('settings.sync.pendingMdFiles', { count: status.changedMdCount })}</span>
                  {(status.ahead > 0 || status.behind > 0) && (
                    <>
                      <span className="settings-backup-summary-sep">·</span>
                      {status.behind > 0 && <span>{t('settings.sync.behindRemote', { count: status.behind })}</span>}
                      {status.behind > 0 && status.ahead > 0 && <span className="settings-backup-summary-sep">·</span>}
                      {status.ahead > 0 && <span>{t('settings.sync.aheadRemote', { count: status.ahead })}</span>}
                    </>
                  )}
                </div>
                <div className="settings-sync-commit-preview">
                  {t('settings.sync.commitPreview', { message: commitPreview })}
                </div>
              </div>
            )}

            {!usesSystemGit && (
              <div className="settings-sync-info">
                <div className="settings-sync-info-row">
                  <span className="settings-sync-info-label">{t('settings.sync.corsProxy')}</span>
                  <input
                    className="settings-input"
                    value={gitCorsProxy}
                    onChange={(e) => setGitCorsProxy(e.target.value)}
                    placeholder="https://cors.isomorphic-git.org"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                </div>
                {isWeb() && (
                  <p className="settings-sync-empty-hint">{t('settings.sync.webSshUnsupported')}</p>
                )}
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleSaveCors} disabled={busy}>
                  {t('settings.sync.saveConfig')}
                </button>
              </div>
            )}

            <div className="settings-backup-actions settings-sync-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handlePull}
                disabled={enabledCount === 0 || busy}
                title={enabledCount === 0 ? t('settings.sync.addRemoteFirst') : undefined}
              >
                {pulling ? <Loader2 size={13} className="settings-spin" /> : <ArrowDownToLine size={13} />}
                {pulling ? t('settings.sync.pulling') : t('settings.sync.pullLatest')}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handlePush}
                disabled={enabledCount === 0 || busy}
                title={enabledCount === 0 ? t('settings.sync.addRemoteFirst') : undefined}
              >
                {pushing ? <Loader2 size={13} className="settings-spin" /> : <Upload size={13} />}
                {pushing
                  ? t('settings.sync.pushing')
                  : t('settings.sync.pushToAll', { count: Math.max(enabledCount, 1) })}
              </button>
            </div>

            {syncError && (
              <div className="settings-sync-error">
                <pre>{syncError}</pre>
              </div>
            )}
            </div>

            {status?.isRepo && (
              <div className="settings-backup-list">
                <div className="settings-backup-list-header">
                  <span>{t('settings.sync.changedMarkdownFiles')}</span>
                  {status.changedFiles.length > 0 && (
                    <span className="settings-backup-list-count">{status.changedFiles.length}</span>
                  )}
                </div>
                {status.changedFiles.length === 0 ? (
                  <div className="settings-backup-list-empty">{t('settings.sync.noPendingMdChanges')}</div>
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
                            {t('settings.sync.viewDiff')}
                          </button>
                          <button
                            type="button"
                            className="settings-sync-file-link settings-sync-file-link-muted"
                            onClick={() => setRevertTarget(file)}
                            disabled={busy || revertingPath === file.path}
                          >
                            {revertingPath === file.path ? t('settings.sync.reverting') : t('settings.sync.revertChange')}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <SyncDiffModal
        open={diffModal.open}
        filePath={diffModal.file?.path ?? null}
        diff={diffModal.data}
        loading={diffModal.loading}
        onClose={() => setDiffModal({ open: false, file: null, data: null, loading: false })}
      />

      <GitRemoteSetupModal
        open={wizardOpen}
        storagePath={storagePath ?? ''}
        existingRemoteNames={remotes.map((remote) => remote.name)}
        presetProvider={reauthRemote ? null : wizardProvider}
        presetRemoteName={reauthRemote ? null : wizardRemoteName}
        reauth={reauthRemote ? { name: reauthRemote.name, provider: reauthRemote.provider, host: reauthRemote.host } : null}
        onClose={() => { setWizardOpen(false); setReauthRemote(null); setWizardProvider(null); setWizardRemoteName(null); }}
        onConnected={(remoteName) => {
          void loadLocalConfig().then((cfg) => {
            const match = cfg.gitRemotes.find((remote) => remote.name === remoteName)
              ?? cfg.gitRemotes.find((remote) => remote.provider === wizardProvider);
            if (match) setSelectedRemoteId(match.id);
          });
          void refreshStatus();
        }}
      />

      <ConfirmModal
        open={!!revertTarget}
        onClose={() => setRevertTarget(null)}
        onConfirm={() => { if (revertTarget) handleRevert(revertTarget); }}
        title={t('settings.sync.revertTitle')}
        message={
          revertTarget?.changeType === 'added'
            ? t('settings.sync.revertAddedConfirm', { path: revertTarget.path })
            : revertTarget?.changeType === 'deleted'
              ? t('settings.sync.revertDeletedConfirm', { path: revertTarget.path })
              : t('settings.sync.revertModifiedConfirm', { path: revertTarget?.path ?? '' })
        }
        confirmLabel={t('settings.sync.revertConfirm')}
      />

      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => { if (removeTarget) void handleRemoveRemote(removeTarget); }}
        title={t('settings.sync.removeRemote')}
        message={t('settings.sync.removeRemoteConfirm', { name: removeTarget?.name ?? '' })}
        confirmLabel={t('settings.sync.removeRemote')}
      />
    </div>
  );
};

export default SyncSettings;
