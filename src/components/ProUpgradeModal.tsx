import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, FilePlus, FolderOpen, KeyRound, Loader2, X } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { PURCHASE_URL } from '@/constants/app';
import type { ProFeature } from '@/constants/pro';
import { useLicenseStore } from '@/store/useLicenseStore';
import { useStore } from '@/store/useStore';
import { collectSpaceArticleNotebooks } from '@/utils/fileSystem';
import { useI18n } from '@/i18n/useI18n';
import { showToast } from './Toast';

function featureMessageKey(feature: ProFeature | null): string {
  switch (feature) {
    case 'spaceLimit':
      return 'pro.gate.spaceLimit';
    case 'notebookLimit':
      return 'pro.gate.notebookLimit';
    case 'articleNotebook':
      return 'pro.gate.articleNotebook';
    case 'sync':
      return 'pro.gate.sync';
    default:
      return 'pro.gate.generic';
  }
}

function mapActivateError(code: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (code === 'EMPTY_KEY') return t('pro.errors.emptyKey');
  if (code === 'NETWORK') return t('pro.errors.network');
  if (/activation/i.test(code) || /limit/i.test(code)) return t('pro.errors.activationLimit');
  if (/invalid/i.test(code) || /not.?found/i.test(code) || /422/.test(code)) return t('pro.errors.invalidKey');
  return t('pro.errors.activateFailed', { detail: code });
}

const ProUpgradeModal: React.FC = () => {
  const { t } = useI18n();
  const gateOpen = useLicenseStore((s) => s.gateOpen);
  const gateFeature = useLicenseStore((s) => s.gateFeature);
  const gateContext = useLicenseStore((s) => s.gateContext);
  const busy = useLicenseStore((s) => s.busy);
  const error = useLicenseStore((s) => s.error);
  const closeGate = useLicenseStore((s) => s.closeGate);
  const activate = useLicenseStore((s) => s.activate);
  const clearError = useLicenseStore((s) => s.clearError);
  const currentSpace = useStore((s) => s.currentSpace);
  const addNotebook = useStore((s) => s.addNotebook);
  const revealNotebook = useStore((s) => s.revealNotebook);
  const refreshCurrentSpaceTree = useStore((s) => s.refreshCurrentSpaceTree);
  const [licenseKey, setLicenseKey] = useState('');
  const [showActivate, setShowActivate] = useState(false);
  const [creatingSample, setCreatingSample] = useState(false);
  const [treeReady, setTreeReady] = useState(false);

  const sampleFormat = gateContext?.format ?? 'markdown';

  const existingSample = useMemo(() => {
    if (!currentSpace || !treeReady) return null;
    return collectSpaceArticleNotebooks(currentSpace, sampleFormat)[0] ?? null;
  }, [currentSpace, treeReady, sampleFormat]);

  const showSampleAction = gateFeature === 'articleNotebook';
  const canCreateSample = showSampleAction
    && treeReady
    && !existingSample
    && (!!gateContext || !!currentSpace);

  useEffect(() => {
    if (!gateOpen) {
      setLicenseKey('');
      setShowActivate(false);
      setCreatingSample(false);
      setTreeReady(false);
      clearError();
      return;
    }

    if (gateFeature !== 'articleNotebook') {
      setTreeReady(true);
      return;
    }

    let cancelled = false;
    setTreeReady(false);
    void (async () => {
      try {
        await refreshCurrentSpaceTree();
      } finally {
        if (!cancelled) setTreeReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [gateOpen, gateFeature, clearError, refreshCurrentSpaceTree]);

  if (!gateOpen) return null;

  const handlePurchase = async () => {
    try {
      await openUrl(PURCHASE_URL);
    } catch {
      showToast(t('pro.errors.openPurchaseFailed'));
    }
  };

  const handleActivate = async () => {
    const ok = await activate(licenseKey);
    if (ok) {
      showToast(t('pro.activated'));
      closeGate();
    }
  };

  const handleCreateSample = async () => {
    if (creatingSample || existingSample) return;
    const parentPath = gateContext?.parentPath ?? currentSpace?.path;
    const format = sampleFormat;
    if (!parentPath) return;

    setCreatingSample(true);
    try {
      const sampleName = format === 'writer'
        ? t('pro.trial.sampleWriterName')
        : t('pro.trial.sampleMarkdownName');
      const notebook = await addNotebook(parentPath, sampleName, format);
      if (notebook) {
        await revealNotebook(notebook);
        showToast(t('pro.trial.sampleCreated', { name: notebook.name }));
        closeGate();
      }
    } finally {
      setCreatingSample(false);
    }
  };

  const handleOpenSample = async () => {
    if (!existingSample) return;
    await revealNotebook(existingSample);
    closeGate();
  };

  return (
    <div className="modal-overlay pro-upgrade-overlay" onClick={closeGate}>
      <div className="modal pro-upgrade-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pro-upgrade-header">
          <h3 className="modal-title">{t('pro.gate.title')}</h3>
          <button type="button" className="icon-btn" onClick={closeGate} title={t('common.close')}>
            <X size={16} />
          </button>
        </div>

        <p className="modal-message">{t(featureMessageKey(gateFeature))}</p>
        <p className="pro-upgrade-hint">{t('pro.gate.hint')}</p>

        {gateFeature === 'articleNotebook' && (
          <p className="pro-upgrade-trial-hint">
            {existingSample
              ? t('pro.trial.articleExists', { name: existingSample.name })
              : t('pro.trial.articleHint')}
          </p>
        )}

        {!showActivate ? (
          <div className="modal-actions pro-upgrade-actions">
            <button type="button" className="btn btn-secondary" onClick={closeGate}>
              {t('common.cancel')}
            </button>
            {canCreateSample && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void handleCreateSample()}
                disabled={creatingSample}
              >
                {creatingSample ? <Loader2 size={14} className="settings-spin" /> : <FilePlus size={14} />}
                {t('pro.trial.createSample')}
              </button>
            )}
            {showSampleAction && existingSample && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void handleOpenSample()}
              >
                <FolderOpen size={14} />
                {t('pro.trial.openSample')}
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => setShowActivate(true)}>
              <KeyRound size={14} />
              {t('pro.gate.activate')}
            </button>
            <button type="button" className="btn btn-primary" onClick={handlePurchase}>
              <ExternalLink size={14} />
              {t('pro.gate.purchase')}
            </button>
          </div>
        ) : (
          <div className="pro-activate-form">
            <label className="pro-activate-label" htmlFor="pro-license-key-input">
              {t('pro.licenseKey')}
            </label>
            <input
              id="pro-license-key-input"
              className="pro-activate-input"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder={t('pro.licenseKeyPlaceholder')}
              autoFocus
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleActivate();
              }}
            />
            {error && <p className="pro-activate-error">{mapActivateError(error, t)}</p>}
            <div className="modal-actions pro-upgrade-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowActivate(false)} disabled={busy}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleActivate()}
                disabled={busy || !licenseKey.trim()}
              >
                {busy ? <Loader2 size={14} className="settings-spin" /> : <KeyRound size={14} />}
                {busy ? t('pro.activating') : t('pro.gate.activate')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProUpgradeModal;
