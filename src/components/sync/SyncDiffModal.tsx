import React from 'react';
import { Loader2, X } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import { getDisplayDiffLines, type FileDiff } from '@/utils/sync';

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
  const { t } = useI18n();

  if (!open || !filePath) return null;

  const displayLines = diff?.diff ? getDisplayDiffLines(diff.diff) : [];

  return (
    <div className="modal-overlay settings-sync-diff-overlay" onClick={onClose}>
      <div className="settings-sync-diff-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-sync-diff-header">
          <div>
            <h3 className="modal-title">{t('settings.sync.diffTitle')}</h3>
            <p className="settings-sync-diff-path" title={filePath}>{filePath}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} title={t('common.close')}>
            <X size={18} />
          </button>
        </div>
        <div className="settings-sync-diff-body">
          {loading ? (
            <div className="settings-sync-diff-loading">
              <Loader2 size={18} className="settings-spin" />
              {t('settings.sync.diffLoading')}
            </div>
          ) : displayLines.length > 0 ? (
            displayLines.map((line, index) => (
              <DiffLine key={`${index}-${line.slice(0, 8)}`} line={line} />
            ))
          ) : (
            <div className="settings-sync-diff-empty">{t('settings.sync.diffEmpty')}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SyncDiffModal;
