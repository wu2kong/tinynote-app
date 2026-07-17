import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import {
  DEFAULT_SEARCH_FILTERS,
  FILTER_OPTIONS,
  SearchFilters,
  GlobalSearchResult,
  performGlobalSearch,
  getResultTitleParts,
  splitHighlightSegments,
} from '@/utils/globalSearch';

interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
}

const HighlightedText: React.FC<{ text: string; query: string }> = ({ text, query }) => (
  <>
    {splitHighlightSegments(text, query).map((seg, i) =>
      seg.highlight ? (
        <span key={i} className="global-search-highlight">{seg.text}</span>
      ) : (
        <React.Fragment key={i}>{seg.text}</React.Fragment>
      ),
    )}
  </>
);

const ResultTitle: React.FC<{ result: GlobalSearchResult; query: string }> = ({ result, query }) => {
  const parts = getResultTitleParts(result);
  return (
    <div className="global-search-result-title">
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span> / </span>}
          <HighlightedText text={part} query={query} />
        </React.Fragment>
      ))}
    </div>
  );
};

const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ open, onClose }) => {
  const spaces = useStore((s) => s.spaces);
  const navigateToGlobalSearchResult = useStore((s) => s.navigateToGlobalSearchResult);

  const [inputValue, setInputValue] = React.useState('');
  const [activeQuery, setActiveQuery] = React.useState('');
  const [filters, setFilters] = React.useState<SearchFilters>({ ...DEFAULT_SEARCH_FILTERS });
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(
    () => performGlobalSearch(spaces, activeQuery, filters, 50),
    [spaces, activeQuery, filters],
  );

  const runSearch = useCallback(() => {
    setActiveQuery(inputValue.trim());
  }, [inputValue]);

  useEffect(() => {
    if (!open) return;
    const query = inputValue.trim();
    if (!query) {
      setActiveQuery('');
      return;
    }
    const timer = window.setTimeout(() => setActiveQuery(query), 200);
    return () => window.clearTimeout(timer);
  }, [inputValue, open]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const toggleFilter = (key: keyof SearchFilters) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelect = async (result: GlobalSearchResult) => {
    onClose();
    await navigateToGlobalSearchResult(result);
  };

  const handleClearInput = () => {
    setInputValue('');
    inputRef.current?.focus();
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal global-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="global-search-input-wrap">
          <Search size={16} className="global-search-input-icon" />
          <input
            ref={inputRef}
            className="global-search-input"
            type="text"
            placeholder="全局搜索..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                runSearch();
              }
            }}
          />
          {inputValue && (
            <button
              type="button"
              className="global-search-clear-btn"
              onClick={handleClearInput}
              title="清空"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="global-search-filters">
          <span className="global-search-filters-label">匹配范围：</span>
          {FILTER_OPTIONS.map(({ key, label }) => (
            <label
              key={key}
              className={`global-search-filter ${filters[key] ? 'checked' : ''}`}
            >
              <input
                type="checkbox"
                checked={filters[key]}
                onChange={() => toggleFilter(key)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <div className="global-search-results">
          {activeQuery === '' ? (
            <div className="global-search-empty">输入关键词后按 Enter 搜索</div>
          ) : results.length === 0 ? (
            <div className="global-search-empty">未找到匹配结果</div>
          ) : (
            results.map((result) => (
              <button
                key={result.id}
                type="button"
                className="global-search-result-item"
                onClick={() => handleSelect(result)}
              >
                <ResultTitle result={result} query={activeQuery} />
                <div className="global-search-result-meta">{result.matchLabels.join(' · ')}</div>
              </button>
            ))
          )}
        </div>

        <div className="global-search-shortcuts">
          <span>输入后自动搜索、</span>
          <span><kbd>Esc</kbd> 关闭弹窗</span>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearchModal;
