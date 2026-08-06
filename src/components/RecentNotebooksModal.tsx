import React, { useEffect } from 'react';
import { Clock3, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { RecentNotebookHistoryItem } from '@/types';
import { useI18n } from '@/i18n/useI18n';

interface RecentNotebooksModalProps {
  open: boolean;
  onClose: () => void;
}

const RecentNotebooksModal: React.FC<RecentNotebooksModalProps> = ({ open, onClose }) => {
  const history = useStore((s) => s.recentNotebookHistory);
  const selectRecentNotebook = useStore((s) => s.selectRecentNotebook);
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const handleSelect = async (item: RecentNotebookHistoryItem) => {
    onClose();
    await selectRecentNotebook(item);
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal recent-notebooks-modal" onClick={(event) => event.stopPropagation()}>
        <div className="recent-notebooks-header">
          <div>
            <h3>{t('recent.title')}</h3>
            <span>{t('recent.subtitle')}</span>
          </div>
          <button type="button" className="recent-notebooks-close" onClick={onClose} title={t('common.close')}>
            <X size={16} />
          </button>
        </div>
        <div className="recent-notebooks-list">
          {history.length === 0 ? (
            <div className="recent-notebooks-empty">{t('recent.empty')}</div>
          ) : history.map((item) => (
            <button
              key={item.path}
              type="button"
              className="recent-notebooks-item"
              onClick={() => handleSelect(item)}
            >
              <Clock3 size={15} />
              <span className="recent-notebooks-item-name">{item.name}</span>
              <span className="recent-notebooks-item-path" title={item.path}>{item.path}</span>
            </button>
          ))}
        </div>
        <div className="recent-notebooks-shortcut"><kbd>Esc</kbd> {t('recent.close')}</div>
      </div>
    </div>
  );
};

export default RecentNotebooksModal;
