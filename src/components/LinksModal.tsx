import React from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { showToast } from './Toast';

interface LinksModalProps {
  open: boolean;
  onClose: () => void;
  links: string[];
}

const copyLink = async (url: string) => {
  try {
    await writeText(url);
    showToast('链接已复制');
    return;
  } catch {
    try {
      await navigator.clipboard.writeText(url);
      showToast('链接已复制');
    } catch {
      showToast('复制失败');
    }
  }
};

const openLink = async (url: string) => {
  try {
    await openUrl(url);
  } catch {
    showToast('无法打开链接');
  }
};

const LinksModal: React.FC<LinksModalProps> = ({ open, onClose, links }) => {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal links-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">链接列表（{links.length}）</h3>
        <div className="links-modal-list">
          {links.map((url) => (
            <div key={url} className="links-modal-item">
              <span className="links-modal-url" title={url}>
                {url}
              </span>
              <div className="links-modal-item-actions">
                <button
                  className="links-modal-action-btn"
                  title="复制链接"
                  onClick={() => copyLink(url)}
                >
                  <Copy size={14} />
                </button>
                <button
                  className="links-modal-action-btn"
                  title="打开链接"
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
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default LinksModal;
