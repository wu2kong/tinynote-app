import React, { useState, useEffect } from 'react';

interface InputModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  placeholder: string;
  defaultValue?: string;
  confirmLabel?: string;
}

const InputModal: React.FC<InputModalProps> = ({ open, onClose, onSubmit, title, placeholder, defaultValue = '', confirmLabel = '新建' }) => {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
    }
  }, [open, defaultValue]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
      setValue('');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        <form onSubmit={handleSubmit}>
          <input
            className="modal-input"
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary">{confirmLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InputModal;