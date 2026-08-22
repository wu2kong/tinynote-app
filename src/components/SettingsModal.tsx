import React, { useState, useEffect, useCallback } from 'react';
import { X, Settings, Info, Database, ExternalLink, RefreshCw, Download, Loader2, Copy, FolderOpen, Check, Archive, HardDrive, GitBranch, Bot, KeyRound, Save, ListRestart, Plus, Trash2, Crown, Mail, MessageSquare } from 'lucide-react';
import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '@/store/useStore';
import { ColorThemeId, SpaceGroupDisplayMode, ViewMode } from '@/types';
import { COLOR_THEMES } from '@/themes';
import { HOMEPAGE_URL, AUTHOR_NAME, AUTHOR_URL, MIRROR_DOWNLOAD_URL, PURCHASE_URL, FEEDBACK_EMAIL } from '@/constants/app';
import { checkForUpdate, checkWithNativeUpdater, downloadAndInstall, formatUpdateError, getAppVersion, isMacOS, isWindows, openReleasePage, UpdateInfo } from '@/utils/updater';
import { getConfigFilePath, getAppDirectory, getWorkspacesFilePath } from '@/utils/appPaths';
import { createBackup, formatBackupSize, getBackupStats, loadBackupDir, saveBackupDir, selectBackupDir, BackupStats } from '@/utils/backup';
import { loadConfig, saveConfig } from '@/utils/config';
import { DEFAULT_LLM_PROVIDERS, LLMModelConfig, LLMProviderConfig, LLMProviderId } from '@/utils/configTypes';
import { getPlatform, isTauri } from '@/platform/detect';
import OfficialSampleLibraryModal from './OfficialSampleLibraryModal';
import SyncSettings from './sync/SyncSettings';
import { showToast } from './Toast';
import { t as globalT } from '@/i18n';
import { useI18n, type AppLocale } from '@/i18n/useI18n';
import { useLicenseStore } from '@/store/useLicenseStore';

type SettingsModule = 'general' | 'ai' | 'data' | 'shortcuts' | 'backup' | 'sync' | 'pro' | 'feedback' | 'about';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const MODULES: { id: SettingsModule; icon: React.ReactNode }[] = [
  { id: 'general', icon: <Settings size={16} /> },
  { id: 'data', icon: <Database size={16} /> },
  { id: 'sync', icon: <GitBranch size={16} /> },
  { id: 'backup', icon: <Archive size={16} /> },
  { id: 'ai', icon: <Bot size={16} /> },
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
  const spaceGroupDisplayMode = useStore((s) => s.spaceGroupDisplayMode);
  const zoomLevel = useStore((s) => s.zoomLevel);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const setColorTheme = useStore((s) => s.setColorTheme);
  const toggleAppBar = useStore((s) => s.toggleAppBar);
  const toggleHideElementBorders = useStore((s) => s.toggleHideElementBorders);
  const setViewMode = useStore((s) => s.setViewMode);
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

const PROVIDER_LABELS: Record<LLMProviderId, string> = {
  openai: 'OpenAI',
  'opencode-go': 'OpenCode Go',
  'opencode-zen': 'OpenCode Zen',
  deepseek: 'DeepSeek',
  custom: 'settings.ai.customProvider',
};

const PROVIDER_DESCRIPTION_KEYS: Record<LLMProviderId, string> = {
  openai: 'settings.ai.providerDescriptions.openai',
  'opencode-go': 'settings.ai.providerDescriptions.opencodeGo',
  'opencode-zen': 'settings.ai.providerDescriptions.opencodeZen',
  deepseek: 'settings.ai.providerDescriptions.deepseek',
  custom: 'settings.ai.providerDescriptions.custom',
};

const PROVIDER_KEY_PLACEHOLDERS: Record<LLMProviderId, string> = {
  openai: 'sk-...',
  'opencode-go': 'OpenCode Go API Key',
  'opencode-zen': 'OpenCode Zen API Key',
  deepseek: 'sk-...',
  custom: 'settings.ai.apiKeyOptionalPlaceholder',
};

function normalizeProviders(providers: LLMProviderConfig[] | undefined): LLMProviderConfig[] {
  return DEFAULT_LLM_PROVIDERS.map((fallback) => ({
    ...fallback,
    ...providers?.find((provider) => provider.id === fallback.id),
    models: providers?.find((provider) => provider.id === fallback.id)?.models?.filter((model) => model.id.trim()),
  }));
}

function getModelsUrl(baseUrl: string): string {
  return `${baseUrl.trim().replace(/\/+$/, '')}/models`;
}

function parseModels(payload: unknown): LLMModelConfig[] {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { data?: unknown }).data)) {
    throw new Error(globalT('settings.ai.invalidModelList'));
  }
  const ids = (payload as { data: unknown[] }).data
    .map((item) => typeof item === 'object' && item ? (item as { id?: unknown }).id : undefined)
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b)).map((id) => ({ id, enabled: false }));
}

async function requestProviderModels(baseUrl: string, apiKey: string | null): Promise<unknown> {
  if (isTauri()) {
    const payload = await invoke<string>('fetch_llm_models', { baseUrl, apiKey });
    return JSON.parse(payload) as unknown;
  }

  const response = await fetch(getModelsUrl(baseUrl), {
    headers: apiKey?.trim() ? { Authorization: `Bearer ${apiKey.trim()}` } : undefined,
  });
  if (!response.ok) throw new Error(globalT('settings.ai.requestFailed', { status: response.status }));
  return response.json();
}

const AISettings: React.FC = () => {
  const { t } = useI18n();
  const [providers, setProviders] = useState<LLMProviderConfig[]>(() => normalizeProviders(undefined));
  const [selectedId, setSelectedId] = useState<LLMProviderId>('openai');
  const [saving, setSaving] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [manualModelId, setManualModelId] = useState('');

  useEffect(() => {
    loadConfig().then((config) => setProviders(normalizeProviders(config.llmProviders)));
  }, []);

  const selected = providers.find((provider) => provider.id === selectedId) ?? providers[0];
  const providerLabel = (id: LLMProviderId) => {
    const label = PROVIDER_LABELS[id];
    return label.startsWith('settings.') ? t(label) : label;
  };
  const providerKeyPlaceholder = (id: LLMProviderId) => {
    const placeholder = PROVIDER_KEY_PLACEHOLDERS[id];
    return placeholder.startsWith('settings.') ? t(placeholder) : placeholder;
  };

  const updateProvider = (patch: Partial<LLMProviderConfig>) => {
    setProviders((current) => current.map((provider) => (
      provider.id === selectedId ? { ...provider, ...patch } : provider
    )));
  };

  const handleFetchModels = async () => {
    const baseUrl = selected.baseUrl.trim().replace(/\/+$/, '');
    if (!baseUrl) {
      showToast(t('settings.ai.fillApiUrlFirst'));
      return;
    }

    setLoadingModels(true);
    try {
      const fetchedModels = parseModels(await requestProviderModels(baseUrl, selected.apiKey));
      const existingModels = selected.models ?? [];
      const previous = new Map(existingModels.map((model) => [model.id, model.enabled]));
      const fetchedIds = new Set(fetchedModels.map((model) => model.id));
      updateProvider({
        models: [
          ...fetchedModels.map((model) => ({ ...model, enabled: previous.get(model.id) ?? model.id === selected.model })),
          ...existingModels.filter((model) => !fetchedIds.has(model.id)),
        ],
      });
      showToast(t('settings.ai.modelsFetched', { count: fetchedModels.length }));
    } catch (error) {
      showToast(error instanceof Error ? `${t('settings.ai.fetchModelsFailed')}: ${error.message}` : t('settings.ai.fetchModelsFailed'));
    } finally {
      setLoadingModels(false);
    }
  };

  const toggleModel = (modelId: string) => {
    const models = (selected.models ?? []).map((model) => (
      model.id === modelId ? { ...model, enabled: !model.enabled } : model
    ));
    const enabledModel = models.find((model) => model.enabled);
    updateProvider({ models, model: enabledModel?.id ?? selected.model });
  };

  const removeModel = (modelId: string) => {
    const models = (selected.models ?? []).filter((model) => model.id !== modelId);
    const nextDefaultModel = selected.model === modelId
      ? models.find((model) => model.enabled)?.id ?? ''
      : selected.model;
    updateProvider({ models, model: nextDefaultModel });
    showToast(t('settings.ai.removedModel', { model: modelId }));
  };

  const handleAddModel = () => {
    const modelId = manualModelId.trim();
    if (!modelId) {
      showToast(t('settings.ai.enterModelName'));
      return;
    }
    if ((selected.models ?? []).some((model) => model.id === modelId)) {
      showToast(t('settings.ai.modelAlreadyExists'));
      return;
    }
    updateProvider({
      models: [...(selected.models ?? []), { id: modelId, enabled: true }],
      model: modelId,
    });
    setManualModelId('');
    showToast(t('settings.ai.addedAndEnabled', { model: modelId }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveConfig({
        llmProviders: providers.map((provider) => ({
          ...provider,
          apiKey: provider.apiKey?.trim() || null,
          baseUrl: provider.baseUrl.trim().replace(/\/$/, ''),
          model: provider.model.trim(),
          models: provider.models?.filter((model) => model.id.trim()).map((model) => ({ ...model, id: model.id.trim() })),
        })),
      });
      showToast(t('settings.ai.saved'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-panel ai-settings">
      <div className="settings-panel-head">
        <h4 className="settings-panel-title">{t('settings.ai.panelTitle')}</h4>
        <p className="settings-panel-desc">{t('settings.ai.panelDesc')}</p>
      </div>

      <div className="ai-provider-tabs" role="tablist" aria-label={t('settings.ai.providerTabsLabel')}>
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            role="tab"
            aria-selected={selectedId === provider.id}
            className={`ai-provider-tab ${selectedId === provider.id ? 'active' : ''}`}
            onClick={() => setSelectedId(provider.id)}
          >
            {providerLabel(provider.id)}
            {provider.enabled && <span className="ai-provider-status">{t('settings.ai.enabled')}</span>}
          </button>
        ))}
      </div>

      <div className="ai-provider-head">
        <div>
          <div className="settings-row-label">{providerLabel(selected.id)}</div>
          <p className="settings-panel-desc">{t(PROVIDER_DESCRIPTION_KEYS[selected.id])}</p>
        </div>
        <SettingsToggle checked={selected.enabled} onChange={() => updateProvider({ enabled: !selected.enabled })} />
      </div>

      <label className="ai-settings-field">
        <span>{t('settings.ai.apiUrl')}</span>
        <input
          className="settings-input"
          type="url"
          value={selected.baseUrl}
          onChange={(event) => updateProvider({ baseUrl: event.target.value })}
          placeholder="https://api.example.com/v1"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </label>

      <div className="ai-models-head">
        <div>
          <span className="ai-models-title">{t('settings.ai.modelList')}</span>
          <p className="ai-models-desc">{t('settings.ai.modelListDesc')}</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleFetchModels} disabled={loadingModels}>
          {loadingModels ? <Loader2 size={14} className="settings-spin" /> : <ListRestart size={14} />}
          {loadingModels ? t('settings.ai.fetchingModels') : t('settings.ai.fetchModels')}
        </button>
      </div>

      {selected.models && selected.models.length > 0 && (
        <div className="ai-model-list" aria-label={t('settings.ai.modelsLabel', { provider: providerLabel(selected.id) })}>
          {selected.models.map((model) => (
            <div className="ai-model-row" key={model.id}>
              <code>{model.id}</code>
              <div className="ai-model-actions">
                <SettingsToggle checked={model.enabled} onChange={() => toggleModel(model.id)} />
                <button
                  type="button"
                  className="ai-model-delete"
                  onClick={() => removeModel(model.id)}
                  title={t('settings.ai.deleteModel', { model: model.id })}
                  aria-label={t('settings.ai.deleteModelAria', { model: model.id })}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="ai-add-model">
        <input
          className="settings-input"
          value={manualModelId}
          onChange={(event) => setManualModelId(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleAddModel();
            }
          }}
          placeholder={t('settings.ai.manualModelPlaceholder')}
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddModel}>
          <Plus size={14} />
          {t('settings.ai.addModel')}
        </button>
      </div>

      <label className="ai-settings-field">
        <span>{t('settings.ai.apiKey')}</span>
        <div className="ai-key-input-wrap">
          <KeyRound size={14} />
          <input
            className="settings-input"
            type="password"
            value={selected.apiKey ?? ''}
            onChange={(event) => updateProvider({ apiKey: event.target.value })}
            placeholder={providerKeyPlaceholder(selected.id)}
            autoComplete="off"
          />
        </div>
      </label>

      <label className="ai-settings-field">
        <span>{t('settings.ai.modelName')}</span>
        <input
          className="settings-input"
          value={selected.model}
          onChange={(event) => updateProvider({ model: event.target.value })}
          placeholder={selected.id === 'custom' ? t('settings.ai.modelPlaceholder') : undefined}
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </label>

      <p className="ai-settings-hint">
        {selected.id === 'opencode-go' || selected.id === 'opencode-zen'
          ? t('settings.ai.apiKeyHintSubscription')
          : t('settings.ai.apiKeyHintGeneric')}
      </p>

      <div className="ai-settings-actions">
        <button type="button" className="btn btn-primary btn-sm ai-settings-save" onClick={handleSave} disabled={saving}>
          <Save size={14} />
          {saving ? t('settings.ai.saving') : t('settings.ai.saveConfig')}
        </button>
        <span className="ai-settings-shortcut-hint">
          <kbd>{formatShortcut('I')}</kbd> {t('settings.ai.shortcutHint')}
        </span>
      </div>
    </div>
  );
};

function getModifierKeyLabel(): string {
  if (typeof navigator === 'undefined') return 'Cmd';
  const platform = navigator.userAgent.toLowerCase();
  return /mac|darwin|iphone|ipad|ipod/.test(platform) ? 'Cmd' : 'Ctrl';
}

const SHORTCUT_ITEMS: { key: 'P' | 'I' | 'F' | 'Shift+F'; descriptionKey: string }[] = [
  { key: 'P', descriptionKey: 'settings.shortcuts.history' },
  { key: 'I', descriptionKey: 'settings.shortcuts.aiChat' },
  { key: 'F', descriptionKey: 'settings.shortcuts.workspaceSearch' },
  { key: 'Shift+F', descriptionKey: 'settings.shortcuts.globalSearch' },
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

  const runtime = getPlatform();
  const osLabel = detectOsLabel();
  const platformDisplay = t(`settings.feedback.runtime.${runtime}`);
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

      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">{t('settings.feedback.platform')}</span>
          <span className="settings-row-desc">{platformDisplay} · {osLabel}</span>
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">{t('settings.feedback.version')}</span>
          <span className="settings-row-desc">{version || '...'}</span>
        </div>
      </div>

      <div className="settings-row settings-row-vertical">
        <div className="settings-row-info">
          <span className="settings-row-label">{t('settings.feedback.diagnosticInfo')}</span>
          <span className="settings-row-desc">{t('settings.feedback.diagnosticInfoDesc')}</span>
        </div>
        <pre className="settings-feedback-info">{diagnosticInfo}</pre>
        <div className="settings-update-actions">
          <button type="button" className="btn btn-secondary" onClick={() => void handleCopyInfo()}>
            {copiedInfo ? <Check size={14} /> : <Copy size={14} />}
            {copiedInfo ? t('settings.feedback.copied') : t('settings.feedback.copyInfo')}
          </button>
        </div>
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
  const [showSampleLibrary, setShowSampleLibrary] = useState(false);

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

      <div className="settings-sample-library-card">
        <div className="settings-row-info">
          <span className="settings-row-label">{t('settings.data.sampleLibrary')}</span>
          <span className="settings-row-desc">{t('settings.data.sampleLibraryDesc')}</span>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setShowSampleLibrary(true)}
          disabled={!storagePath}
        >
          <Download size={14} />
          {t('settings.data.importSampleLibrary')}
        </button>
      </div>

      <PathItem label={t('settings.data.workspacesRegistry')} path={workspacesPath} />
      <PathItem label={t('settings.data.currentWorkspaceConfig')} path={configPath} />
      <PathItem label={t('settings.data.currentStorageDir')} path={storagePath} />
      <PathItem label={t('settings.data.currentAppDir')} path={appDir} />

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
    setChecking(true);
    setCheckMessage('');
    setUpdateInfo(null);
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

  const handleManualDownload = useCallback(async () => {
    if (!updateInfo) return;
    try {
      await openReleasePage(updateInfo.releaseUrl);
    } catch (e) {
      console.error('Failed to open release page:', e);
      showToast(t('settings.about.openReleaseFailed'));
    }
  }, [updateInfo]);

  const handleMirrorDownload = useCallback(async () => {
    try {
      await openUrl(MIRROR_DOWNLOAD_URL);
    } catch (e) {
      console.error('Failed to open mirror download page:', e);
      showToast(t('settings.about.openMirrorFailed'));
    }
  }, []);

  const handleOpenHomepage = useCallback(async () => {
    try {
      await openUrl(HOMEPAGE_URL);
    } catch (e) {
      console.error('Failed to open homepage:', e);
      showToast(t('settings.about.openHomepageFailed'));
    }
  }, []);

  const handleOpenAuthorHomepage = useCallback(async () => {
    try {
      await openUrl(AUTHOR_URL);
    } catch (e) {
      console.error('Failed to open author homepage:', e);
      showToast(t('settings.about.openAuthorFailed'));
    }
  }, []);

  return (
    <div className="settings-panel">
      <h4 className="settings-panel-title">{t('settings.about.panelTitle')}</h4>

      <div className="settings-about-card">
        <div className="settings-about-logo">📝</div>
        <div className="settings-about-info">
          <div className="settings-about-name">TinyNote</div>
          <div className="settings-about-version">{t('settings.about.version', { version: version || '...' })}</div>
          <div className="settings-about-desc">{t('utils.app.description')}</div>
        </div>
      </div>

      <div className="settings-row settings-row-vertical">
        <div className="settings-row-info">
          <span className="settings-row-label">{t('settings.about.projectAuthor')}</span>
          <button type="button" className="settings-link" onClick={handleOpenAuthorHomepage}>
            {AUTHOR_NAME}
            <ExternalLink size={14} />
          </button>
          <span className="settings-row-desc">{AUTHOR_URL}</span>
        </div>
      </div>

      <div className="settings-row settings-row-vertical">
        <div className="settings-row-info">
          <span className="settings-row-label">{t('settings.about.projectHome')}</span>
          <button type="button" className="settings-link" onClick={handleOpenHomepage}>
            {HOMEPAGE_URL}
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      <div className="settings-row settings-row-vertical" aria-busy={checking || downloading}>
        <div className="settings-row-info">
          <span className="settings-row-label">{t('settings.about.softwareUpdate')}</span>
          <span className="settings-row-desc">{t(isMacOS() ? 'settings.about.softwareUpdateDescMacos' : isWindows() ? 'settings.about.softwareUpdateDescWindows' : 'settings.about.softwareUpdateDesc')}</span>
        </div>
        <div className="settings-update-actions">
          <button
            type="button"
            className={`btn btn-secondary${checking ? ' is-loading' : ''}`}
            onClick={handleCheckUpdate}
            disabled={checking || downloading}
            aria-busy={checking}
          >
            {checking ? <Loader2 size={14} className="settings-spin" /> : <RefreshCw size={14} />}
            {checking ? t('settings.about.checking') : t('settings.about.checkUpdate')}
          </button>
          {updateInfo && (
            <>
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
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleManualDownload}
                disabled={downloading}
              >
                <ExternalLink size={14} />
                {t('settings.about.githubDownload')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleMirrorDownload}
                disabled={downloading}
              >
                <ExternalLink size={14} />
                {t('settings.about.mirrorDownload')}
              </button>
            </>
          )}
        </div>
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
      </div>
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
            {activeModule === 'ai' && <AISettings />}
            {activeModule === 'data' && <DataSettings />}
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
