import React, { useState, useEffect } from 'react';
import { useI18n } from '@/i18n/useI18n';

interface InputModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  placeholder: string;
  defaultValue?: string;
  confirmLabel?: string;
  /** Optional hint shown below the title. */
  hint?: string;
  /** When true, hide the input and only allow dismissing via confirm/cancel. */
  readOnly?: boolean;
}

const InputModal: React.FC<InputModalProps> = ({
  open,
  onClose,
  onSubmit,
  title,
  placeholder,
  defaultValue = '',
  confirmLabel,
  hint,
  readOnly = false,
}) => {
  const [value, setValue] = useState(defaultValue);
  const { t } = useI18n();

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
    }
  }, [open, defaultValue]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) {
      onClose();
      return;
    }
    if (value.trim()) {
      onSubmit(value.trim());
      setValue('');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        {hint && <p className="modal-hint">{hint}</p>}
        <form onSubmit={handleSubmit}>
          {!readOnly && (
            <input
              className="modal-input"
              type="text"
              placeholder={placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          )}
          <div className="modal-actions">
            {!readOnly && (
              <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            )}
            <button type="submit" className="btn btn-primary">
              {confirmLabel ?? (readOnly ? t('common.close') : t('common.create'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InputModal;
