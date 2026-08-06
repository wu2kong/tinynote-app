import React from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { showToast } from './Toast';
import { t } from '@/i18n';
import { useI18n } from '@/i18n/useI18n';

interface LinksModalProps {
  open: boolean;
  onClose: () => void;
  links: string[];
}

const copyLink = async (url: string) => {
  try {
    await writeText(url);
    showToast(t('links.copied'));
    return;
  } catch {
    try {
      await navigator.clipboard.writeText(url);
      showToast(t('links.copied'));
    } catch {
      showToast(t('links.copyFailed'));
    }
  }
};

const openLink = async (url: string) => {
  try {
    await openUrl(url);
  } catch {
    showToast(t('links.openFailed'));
  }
};

const LinksModal: React.FC<LinksModalProps> = ({ open, onClose, links }) => {
  const { t } = useI18n();

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal links-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{t('links.title', { count: links.length })}</h3>
        <div className="links-modal-list">
          {links.map((url) => (
            <div key={url} className="links-modal-item">
              <span className="links-modal-url" title={url}>
                {url}
              </span>
              <div className="links-modal-item-actions">
                <button
                  className="links-modal-action-btn"
                  title={t('links.copyLink')}
                  onClick={() => copyLink(url)}
                >
                  <Copy size={14} />
                </button>
                <button
                  className="links-modal-action-btn"
                  title={t('links.openLink')}
                  onClick={() => openLink(url)}
                >
                  <ExternalLink size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LinksModal;
