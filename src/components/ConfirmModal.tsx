import React from 'react';
import { useI18n } from '@/i18n/useI18n';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
}) => {
  const { t } = useI18n();

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>{t('confirm.cancel')}</button>
          <button className="btn btn-danger" onClick={() => { onConfirm(); onClose(); }}>
            {confirmLabel ?? t('confirm.defaultDelete')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;