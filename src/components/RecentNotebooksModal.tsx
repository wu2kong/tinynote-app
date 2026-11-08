import React, { useEffect, useRef, useState } from 'react';
import { Clock3, Search, X } from 'lucide-react';
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
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredHistory = normalizedQuery
    ? history.filter((item) => `${item.name} ${item.path}`.toLocaleLowerCase().includes(normalizedQuery))
    : history;

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    searchRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) activeItemRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, query, open]);

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
        <div className="recent-notebooks-search">
          <Search size={16} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                if (filteredHistory.length) setActiveIndex((index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + filteredHistory.length) % filteredHistory.length);
              } else if (event.key === 'Enter' && filteredHistory[activeIndex]) {
                event.preventDefault();
                void handleSelect(filteredHistory[activeIndex]);
              }
            }}
            placeholder={t('recent.search')}
            aria-label={t('recent.search')}
            aria-controls="recent-notebooks-results"
            aria-activedescendant={filteredHistory[activeIndex] ? `recent-notebook-result-${activeIndex}` : undefined}
          />
        </div>
        <div className="recent-notebooks-list" id="recent-notebooks-results">
          {history.length === 0 ? (
            <div className="recent-notebooks-empty">{t('recent.empty')}</div>
          ) : filteredHistory.length === 0 ? (
            <div className="recent-notebooks-empty">{t('recent.noResults')}</div>
          ) : filteredHistory.map((item, index) => (
            <button
              key={item.path}
              id={`recent-notebook-result-${index}`}
              ref={index === activeIndex ? activeItemRef : undefined}
              type="button"
              className={`recent-notebooks-item${index === activeIndex ? ' active' : ''}`}
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
