import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Globe, KeyRound, Loader2, X } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useI18n } from '@/i18n/useI18n';
import {
  createProviderRepo,
  getGitProvider,
  GIT_PROVIDERS,
  listProviderRepos,
  pollDeviceAuth,
  startDeviceAuth,
  suggestedRemoteName,
  supportsOAuth,
  TINYNOTE_GIT_HOST,
  tokenCreateUrl,
  verifyGitToken,
  type GitDeviceAuthStart,
  type GitProviderRepo,
  type GitRemoteProvider,
} from '@/adapters/sync/gitProviders';
import { listGitRemotes } from '@/utils/sync';
import { connectGitRemote, saveRemoteAuth } from '@/utils/gitSyncSetup';
import { formatSyncError } from '@/utils/sync';
import { showToast } from '@/components/Toast';

type WizardStep = 'provider' | 'auth' | 'repo';

interface GitRemoteSetupModalProps {
  open: boolean;
  storagePath: string;
  existingRemoteNames: string[];
  presetProvider?: GitRemoteProvider | null;
  presetRemoteName?: string | null;
  reauth?: {
    name: string;
    provider: GitRemoteProvider;
    host?: string | null;
  } | null;
  onClose: () => void;
  onConnected: (remoteName?: string) => void;
}

const GitRemoteSetupModal: React.FC<GitRemoteSetupModalProps> = ({
  open,
  storagePath,
  existingRemoteNames,
  presetProvider,
  presetRemoteName,
  reauth,
  onClose,
  onConnected,
}) => {
  const { t } = useI18n();
  const [step, setStep] = useState<WizardStep>('provider');
  const [provider, setProvider] = useState<GitRemoteProvider>('github');
  const [host, setHost] = useState('');
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<GitDeviceAuthStart | null>(null);
  const [repos, setRepos] = useState<GitProviderRepo[]>([]);
  const [repoName, setRepoName] = useState('tinynote-notes');
  const [privateRepo, setPrivateRepo] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const connectExtrasRef = useRef({ host: '', username: '' });

  const reset = useCallback(() => {
    const startProvider = reauth?.provider ?? presetProvider ?? 'github';
    setStep(reauth || presetProvider ? 'auth' : 'provider');
    setProvider(startProvider);
    setHost(reauth?.host ?? '');
    setToken('');
    setUsername('');
    setCustomUrl('');
    setBusy(false);
    setError(null);
    setDevice(null);
    setRepos([]);
    setRepoName('tinynote-notes');
    setPrivateRepo(true);
    setConnecting(false);
    connectExtrasRef.current = { host: reauth?.host ?? '', username: '' };
  }, [presetProvider, reauth]);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!device || !open) return undefined;
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const result = await pollDeviceAuth(provider, device.deviceCode, host || undefined);
        if (cancelled) return;
        if (result.token) {
          setToken(result.token);
          setDevice(null);
          showToast(t('settings.sync.wizard.loginSuccess'));
          await continueAfterToken(result.token);
          return;
        }
        if (result.error) {
          setError(result.error);
          setDevice(null);
          return;
        }
      } catch (e) {
        if (!cancelled) {
          setError(formatSyncError(e, t('settings.sync.wizard.loginFailed')));
          setDevice(null);
        }
        return;
      }
      timer = window.setTimeout(poll, Math.max(device.interval, 3) * 1000);
    };

    timer = window.setTimeout(poll, Math.max(device.interval, 3) * 1000);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [device, host, open, provider, t]);

  const providerLabel = useCallback((id: GitRemoteProvider) => t(`settings.sync.providers.${id}`), [t]);

  const canUseOAuth = useMemo(() => supportsOAuth(provider), [provider]);

  const continueAfterToken = useCallback(async (nextToken: string) => {
    setBusy(true);
    setError(null);
    try {
      if (provider === 'custom') {
        if (!customUrl.trim()) {
          throw new Error(t('settings.sync.wizard.customUrlRequired'));
        }
        await finishConnect(nextToken, customUrl.trim());
        return;
      }
      const user = await verifyGitToken(provider, nextToken, host || undefined);
      const nextHost = host.trim()
        || (provider === 'tinynote' ? TINYNOTE_GIT_HOST : '')
        || user.organizationId
        || '';
      const needsLoginUser = provider === 'codeup' || provider === 'atomgit' || provider === 'tinynote';
      const nextUsername = needsLoginUser ? user.login : username;
      connectExtrasRef.current = { host: nextHost, username: nextUsername || '' };
      if (nextHost) setHost(nextHost);
      if (needsLoginUser && user.login) setUsername(user.login);
      if (reauth) {
        await saveRemoteAuth(reauth.name, provider, nextToken, nextUsername || undefined);
        showToast(t('settings.sync.wizard.reauthSuccess'));
        onConnected(reauth.name);
        onClose();
        return;
      }
      const listed = await listProviderRepos(provider, nextToken, nextHost || undefined);
      setRepos(listed);
      setStep('repo');
    } catch (e) {
      setError(formatSyncError(e, t('settings.sync.wizard.verifyFailed')));
    } finally {
      setBusy(false);
    }
  }, [customUrl, host, onClose, onConnected, provider, reauth, t, username]);

  const finishConnect = useCallback(async (nextToken: string, url: string) => {
    setConnecting(true);
    setError(null);
    try {
      const liveNames = existingRemoteNames.length > 0
        ? existingRemoteNames
        : (await listGitRemotes(storagePath).catch(() => [])).map((item) => item.name);
      const name = reauth?.name ?? presetRemoteName ?? suggestedRemoteName(provider, liveNames);
      await connectGitRemote({
        storagePath,
        provider,
        name,
        url,
        token: nextToken,
        username: username || connectExtrasRef.current.username || undefined,
        host: host || connectExtrasRef.current.host || null,
      });
      showToast(t('settings.sync.wizard.connected', { provider: providerLabel(provider) }));
      onConnected(name);
      onClose();
    } catch (e) {
      setError(formatSyncError(e, t('settings.sync.wizard.connectFailed')));
    } finally {
      setConnecting(false);
    }
  }, [existingRemoteNames, host, onClose, onConnected, presetRemoteName, provider, providerLabel, reauth, storagePath, t, username]);

  const handleSelectProvider = (id: GitRemoteProvider) => {
    const meta = getGitProvider(id);
    if (meta.comingSoon) return;
    setProvider(id);
    setError(null);
    setStep('auth');
  };

  const handleStartOAuth = async () => {
    setBusy(true);
    setError(null);
    try {
      const started = await startDeviceAuth(provider, host || undefined);
      setDevice(started);
      try {
        await openUrl(started.verificationUri);
      } catch {
        showToast(t('settings.sync.wizard.openPageFailed'));
      }
    } catch (e) {
      setError(formatSyncError(e, t('settings.sync.wizard.loginFailed')));
    } finally {
      setBusy(false);
    }
  };

  const handleOpenTokenPage = async () => {
    const url = tokenCreateUrl(provider, host || undefined);
    if (!url) return;
    try {
      await openUrl(url);
    } catch {
      showToast(t('settings.sync.wizard.openPageFailed'));
    }
  };

  const handleVerifyToken = async () => {
    if (!token.trim()) {
      setError(t('settings.sync.wizard.tokenRequired'));
      return;
    }
    await continueAfterToken(token.trim());
  };

  const handleCreateRepo = async () => {
    if (!repoName.trim()) {
      setError(t('settings.sync.wizard.repoNameRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createProviderRepo(provider, token, repoName.trim(), {
        privateRepo,
        host: host || connectExtrasRef.current.host || undefined,
      });
      await finishConnect(token, created.url);
    } catch (e) {
      setError(formatSyncError(e, t('settings.sync.wizard.createRepoFailed')));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const locked = busy || connecting;

  return (
    <div className="modal-overlay settings-sync-wizard-overlay" onClick={locked ? undefined : onClose}>
      <div className="settings-sync-wizard" onClick={(e) => e.stopPropagation()}>
        <div className="settings-sync-wizard-header">
          <div>
            <h3 className="modal-title">
              {reauth ? t('settings.sync.wizard.reauthTitle') : t('settings.sync.wizard.title')}
            </h3>
            <p className="settings-sync-wizard-subtitle">{t('settings.sync.wizard.subtitle')}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} disabled={locked} title={t('common.close')}>
            <X size={18} />
          </button>
        </div>

        <div className="settings-sync-wizard-body">
          {step === 'provider' && (
            <>
              <p className="settings-sync-wizard-hint">{t('settings.sync.wizard.chooseProviderHint')}</p>
              <div className="settings-sync-provider-grid">
                {GIT_PROVIDERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`settings-sync-provider-card ${item.comingSoon ? 'is-disabled' : ''}`}
                    onClick={() => handleSelectProvider(item.id)}
                    disabled={item.comingSoon}
                  >
                    <span className="settings-sync-provider-icon">
                      <Globe size={18} />
                    </span>
                    <span className="settings-sync-provider-name">{providerLabel(item.id)}</span>
                    <span className="settings-sync-provider-desc">
                      {item.comingSoon
                        ? t('settings.sync.wizard.tinynoteSoon')
                        : t(`settings.sync.wizard.providerDesc.${item.id}`)}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 'auth' && (
            <>
              <p className="settings-sync-wizard-hint">{t('settings.sync.wizard.authHint')}</p>
              {provider === 'gitlab' && (
                <label className="settings-sync-field">
                  <span>{t('settings.sync.wizard.gitlabHost')}</span>
                  <input
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="https://gitlab.com"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    disabled={locked}
                  />
                </label>
              )}
              {provider === 'custom' && (
                <>
                  <label className="settings-sync-field">
                    <span>{t('settings.sync.wizard.customUrl')}</span>
                    <input
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="https://git.example.com/you/notes.git"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      disabled={locked}
                    />
                  </label>
                  <label className="settings-sync-field">
                    <span>{t('settings.sync.wizard.customUser')}</span>
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      disabled={locked}
                    />
                  </label>
                </>
              )}

              {canUseOAuth && (
                <div className="settings-sync-auth-block">
                  <button type="button" className="btn btn-primary" onClick={handleStartOAuth} disabled={locked}>
                    {busy && !device ? <Loader2 size={14} className="settings-spin" /> : <KeyRound size={14} />}
                    {t('settings.sync.wizard.loginWith', { provider: providerLabel(provider) })}
                  </button>
                  {device && (
                    <div className="settings-sync-device">
                      <p>{t('settings.sync.wizard.deviceCodeHint')}</p>
                      <code className="settings-sync-device-code">{device.userCode}</code>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openUrl(device.verificationUri)}>
                        <ExternalLink size={13} />
                        {t('settings.sync.wizard.openAuthPage')}
                      </button>
                      <p className="settings-sync-wizard-muted">{t('settings.sync.wizard.waitingAuth')}</p>
                    </div>
                  )}
                  <p className="settings-sync-wizard-muted">{t('settings.sync.wizard.orUseToken')}</p>
                </div>
              )}

              {provider !== 'custom' && (
                <ol className="settings-sync-token-steps">
                  <li>{t('settings.sync.wizard.tokenStepOpen')}</li>
                  <li>{t(`settings.sync.wizard.tokenScope.${provider}`)}</li>
                  <li>{t('settings.sync.wizard.tokenStepPaste')}</li>
                </ol>
              )}
              {provider !== 'custom' && tokenCreateUrl(provider, host || undefined) && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleOpenTokenPage} disabled={locked}>
                  <ExternalLink size={13} />
                  {t('settings.sync.wizard.openTokenPage')}
                </button>
              )}
              <label className="settings-sync-field">
                <span>{t('settings.sync.wizard.tokenLabel')}</span>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={t('settings.sync.wizard.tokenPlaceholder')}
                  disabled={locked}
                />
              </label>
              <div className="settings-sync-wizard-actions">
                {!reauth && !presetProvider && (
                  <button type="button" className="btn btn-secondary" onClick={() => setStep('provider')} disabled={locked}>
                    {t('common.cancel')}
                  </button>
                )}
                <button type="button" className="btn btn-primary" onClick={handleVerifyToken} disabled={locked}>
                  {busy ? <Loader2 size={14} className="settings-spin" /> : null}
                  {t('settings.sync.wizard.verifyToken')}
                </button>
              </div>
            </>
          )}

          {step === 'repo' && (
            <>
              <p className="settings-sync-wizard-hint">{t('settings.sync.wizard.chooseRepoHint')}</p>
              <div className="settings-sync-create-repo">
                <label className="settings-sync-field">
                  <span>{t('settings.sync.wizard.repoName')}</span>
                  <input
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    placeholder={t('settings.sync.wizard.repoNamePlaceholder')}
                    disabled={locked}
                  />
                </label>
                <label className="settings-sync-check">
                  <input
                    type="checkbox"
                    checked={privateRepo}
                    onChange={(e) => setPrivateRepo(e.target.checked)}
                    disabled={locked}
                  />
                  <span>{t('settings.sync.wizard.privateRepo')}</span>
                </label>
                <button type="button" className="btn btn-primary btn-sm" onClick={handleCreateRepo} disabled={locked}>
                  {busy ? <Loader2 size={13} className="settings-spin" /> : null}
                  {t('settings.sync.wizard.createRepo')}
                </button>
              </div>
              <div className="settings-sync-repo-list">
                <div className="settings-backup-list-header">
                  <span>{t('settings.sync.wizard.existingRepos')}</span>
                  {repos.length > 0 && <span className="settings-backup-list-count">{repos.length}</span>}
                </div>
                {repos.length === 0 ? (
                  <div className="settings-backup-list-empty">{t('settings.sync.wizard.noRepos')}</div>
                ) : (
                  <ul className="settings-sync-repo-items">
                    {repos.map((repo) => (
                      <li key={repo.fullName} className="settings-sync-repo-item">
                        <div>
                          <div className="settings-sync-repo-name">{repo.fullName}</div>
                          <div className="settings-sync-repo-url">{repo.url}</div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => finishConnect(token, repo.url)}
                          disabled={locked}
                        >
                          {t('settings.sync.wizard.useThisRepo')}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {connecting && (
            <div className="settings-sync-connecting">
              <Loader2 size={18} className="settings-spin" />
              {t('settings.sync.wizard.connecting')}
            </div>
          )}

          {error && (
            <div className="settings-sync-error">
              <pre>{error}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GitRemoteSetupModal;
