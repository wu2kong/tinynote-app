import React from 'react';

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
  confirmLabel = '删除',
}) => {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-danger" onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;