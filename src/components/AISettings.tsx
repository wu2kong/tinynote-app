import React, { useEffect, useRef, useState } from 'react';
import { KeyRound, ListRestart, Loader2, Minus, Plus, Save, Trash2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { loadConfig, saveConfig } from '@/utils/config';
import { DEFAULT_LLM_PROVIDERS, CUSTOM_LLM_PROVIDER_TEMPLATE, LLMModelConfig, LLMProviderConfig, LLMProviderId, customLLMProviderOrdinal, isBuiltinLLMProviderId, isCustomLLMProviderId, nextCustomLLMProviderId } from '@/utils/configTypes';
import { isTauri } from '@/platform/detect';
import ConfirmModal from './ConfirmModal';
import { showToast } from './Toast';
import { t as globalT } from '@/i18n';
import { useI18n } from '@/i18n/useI18n';

const SettingsToggle: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
  <button type="button" className={"settings-toggle " + (checked ? "active" : "")} onClick={onChange} role="switch" aria-checked={checked}>
    <span className="settings-toggle-thumb" />
  </button>
);

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  'opencode-go': 'OpenCode Go',
  'opencode-zen': 'OpenCode Zen',
  deepseek: 'DeepSeek',
  custom: 'settings.ai.customProvider',
};

const PROVIDER_DESCRIPTION_KEYS: Record<string, string> = {
  openai: 'settings.ai.providerDescriptions.openai',
  'opencode-go': 'settings.ai.providerDescriptions.opencodeGo',
  'opencode-zen': 'settings.ai.providerDescriptions.opencodeZen',
  deepseek: 'settings.ai.providerDescriptions.deepseek',
  custom: 'settings.ai.providerDescriptions.custom',
};

const PROVIDER_KEY_PLACEHOLDERS: Record<string, string> = {
  openai: 'sk-...',
  'opencode-go': 'OpenCode Go API Key',
  'opencode-zen': 'OpenCode Zen API Key',
  deepseek: 'sk-...',
  custom: 'settings.ai.apiKeyOptionalPlaceholder',
};

function mergeProvider(saved: LLMProviderConfig | undefined, fallback: LLMProviderConfig): LLMProviderConfig {
  return {
    ...fallback,
    ...saved,
    id: saved?.id || fallback.id,
    models: saved?.models?.filter((model) => model.id.trim()),
  };
}

function normalizeProviders(providers: LLMProviderConfig[] | undefined): LLMProviderConfig[] {
  if (!providers?.length) {
    return DEFAULT_LLM_PROVIDERS.map((fallback) => ({ ...fallback }));
  }
  const seen = new Set<string>();
  const next: LLMProviderConfig[] = [];
  for (const provider of providers) {
    if (!provider.id || seen.has(provider.id)) continue;
    seen.add(provider.id);
    const fallback = DEFAULT_LLM_PROVIDERS.find((item) => item.id === provider.id)
      ?? CUSTOM_LLM_PROVIDER_TEMPLATE;
    next.push(mergeProvider(provider, fallback));
  }
  return next;
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
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<LLMProviderConfig | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConfig().then((config) => setProviders(normalizeProviders(config.llmProviders)));
  }, []);

  useEffect(() => {
    if (providers.length === 0) return;
    if (!providers.some((provider) => provider.id === selectedId)) {
      setSelectedId(providers[0].id);
    }
  }, [providers, selectedId]);

  useEffect(() => {
    if (!addMenuOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (addMenuRef.current?.contains(event.target as Node)) return;
      setAddMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [addMenuOpen]);

  const selected = providers.find((provider) => provider.id === selectedId) ?? providers[0];
  const addableProviders = [
    ...DEFAULT_LLM_PROVIDERS.filter((item) => isBuiltinLLMProviderId(item.id) && !providers.some((provider) => provider.id === item.id)),
    CUSTOM_LLM_PROVIDER_TEMPLATE,
  ];
  const providerLabel = (id: LLMProviderId) => {
    if (isCustomLLMProviderId(id)) {
      const ordinal = customLLMProviderOrdinal(providers, id);
      return ordinal > 1 ? t('settings.ai.customProviderN', { n: ordinal }) : t('settings.ai.customProvider');
    }
    const label = PROVIDER_LABELS[id];
    return label?.startsWith('settings.') ? t(label) : (label || id);
  };
  const providerDescription = (id: LLMProviderId) => {
    const key = isCustomLLMProviderId(id) ? PROVIDER_DESCRIPTION_KEYS.custom : (PROVIDER_DESCRIPTION_KEYS[id] ?? PROVIDER_DESCRIPTION_KEYS.custom);
    return t(key);
  };
  const providerKeyPlaceholder = (id: LLMProviderId) => {
    const placeholder = isCustomLLMProviderId(id)
      ? PROVIDER_KEY_PLACEHOLDERS.custom
      : (PROVIDER_KEY_PLACEHOLDERS[id] ?? PROVIDER_KEY_PLACEHOLDERS.custom);
    return placeholder.startsWith('settings.') ? t(placeholder) : placeholder;
  };

  const updateProvider = (patch: Partial<LLMProviderConfig>) => {
    setProviders((current) => current.map((provider) => (
      provider.id === selectedId ? { ...provider, ...patch } : provider
    )));
  };

  const handleAddProvider = (id: LLMProviderId) => {
    if (isCustomLLMProviderId(id)) {
      const newId = nextCustomLLMProviderId(providers.map((provider) => provider.id));
      const next = { ...CUSTOM_LLM_PROVIDER_TEMPLATE, id: newId };
      const ordinal = providers.filter((provider) => isCustomLLMProviderId(provider.id)).length + 1;
      const name = ordinal > 1 ? t('settings.ai.customProviderN', { n: ordinal }) : t('settings.ai.customProvider');
      setProviders((current) => [...current, next]);
      setSelectedId(newId);
      setAddMenuOpen(false);
      showToast(t('settings.ai.providerAdded', { name }));
      return;
    }
    const fallback = DEFAULT_LLM_PROVIDERS.find((item) => item.id === id);
    if (!fallback || providers.some((provider) => provider.id === id)) return;
    setProviders((current) => [...current, { ...fallback }]);
    setSelectedId(id);
    setAddMenuOpen(false);
    showToast(t('settings.ai.providerAdded', { name: providerLabel(id) }));
  };

  const handleRemoveSelected = () => {
    if (!selected) return;
    if (providers.length <= 1) {
      showToast(t('settings.ai.keepOneProvider'));
      return;
    }
    setRemoveTarget(selected);
  };

  const handleRemoveProvider = (provider: LLMProviderConfig) => {
    setProviders((current) => current.filter((item) => item.id !== provider.id));
    showToast(t('settings.ai.providerRemoved', { name: providerLabel(provider.id) }));
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
    <div className="settings-panel settings-panel--compact settings-panel--fill ai-settings">
      <div className="settings-panel-head">
        <div className="settings-panel-head-row">
          <div>
            <h4 className="settings-panel-title">{t('settings.ai.panelTitle')}</h4>
          </div>
          <div className="settings-panel-head-actions ai-settings-actions">
            <button type="button" className="btn btn-primary btn-sm ai-settings-save" onClick={handleSave} disabled={saving}>
              <Save size={14} />
              {saving ? t('settings.ai.saving') : t('settings.ai.saveConfig')}
            </button>
          </div>
        </div>
      </div>

      <div className="settings-sync-workspace" role="tablist" aria-label={t('settings.ai.providerTabsLabel')}>
        <div className="settings-sync-source-nav">
          <div className="settings-sync-source-items">
            {providers.length === 0 ? (
              <div className="settings-sync-source-empty">{t('settings.ai.providerListEmpty')}</div>
            ) : (
              providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedId === provider.id}
                  className={`settings-sync-source-item ${selectedId === provider.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedId(provider.id)}
                >
                  <span className="settings-sync-source-item-name">{providerLabel(provider.id)}</span>
                  <span className={`settings-sync-source-dot ${provider.enabled ? 'is-ok' : 'is-off'}`} />
                </button>
              ))
            )}
          </div>
          <div className="settings-sync-source-toolbar">
            <div className="settings-sync-add-wrap" ref={addMenuRef}>
              <button
                type="button"
                className="settings-sync-source-tool"
                title={t('settings.ai.addProvider')}
                onClick={() => setAddMenuOpen((open) => !open)}
              >
                <Plus size={14} />
              </button>
              {addMenuOpen && addableProviders.length > 0 && (
                <div className="settings-sync-add-menu" onClick={(e) => e.stopPropagation()}>
                  {addableProviders.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="settings-sync-add-menu-item"
                      onClick={() => handleAddProvider(item.id)}
                    >
                      <span>{providerLabel(item.id)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="settings-sync-source-tool"
              title={t('settings.ai.removeProvider')}
              disabled={!selected || providers.length <= 1}
              onClick={handleRemoveSelected}
            >
              <Minus size={14} />
            </button>
          </div>
        </div>

        <div className="settings-sync-source-detail">
          {!selected ? (
            <div className="settings-sync-empty">
              <p>{t('settings.ai.noProviderSelected')}</p>
            </div>
          ) : (
            <>
              <div className="settings-sync-detail-head">
                <div>
                  <h5 className="settings-sync-detail-title">{providerLabel(selected.id)}</h5>
                  <p className="settings-sync-detail-desc">{providerDescription(selected.id)}</p>
                </div>
                <div className="settings-sync-detail-badges">
                  {selected.enabled && (
                    <span className="settings-sync-auth-dot is-ok">{t('settings.ai.enabled')}</span>
                  )}
                  <SettingsToggle
                    checked={selected.enabled}
                    onChange={() => updateProvider({ enabled: !selected.enabled })}
                  />
                </div>
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
                <p className="ai-settings-hint">
                  {selected.id === 'opencode-go' || selected.id === 'opencode-zen'
                    ? t('settings.ai.apiKeyHintSubscription')
                    : t('settings.ai.apiKeyHintGeneric')}
                </p>
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
                <span>{t('settings.ai.modelName')}</span>
                <p className="ai-models-desc">{t('settings.ai.modelNameDesc')}</p>
                <input
                  className="settings-input"
                  type="text"
                  value={selected.model}
                  onChange={(event) => updateProvider({ model: event.target.value })}
                  placeholder={isCustomLLMProviderId(selected.id) ? t('settings.ai.modelPlaceholder') : undefined}
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </label>
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => { if (removeTarget) handleRemoveProvider(removeTarget); }}
        title={t('settings.ai.removeProvider')}
        message={t('settings.ai.removeProviderConfirm', { name: removeTarget ? providerLabel(removeTarget.id) : '' })}
        confirmLabel={t('settings.ai.removeProvider')}
      />
    </div>
  );
};

export default AISettings;
