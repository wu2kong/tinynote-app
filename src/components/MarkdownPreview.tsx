import React, { useCallback, useMemo } from 'react';
import { marked } from 'marked';
import { openUrl } from '@tauri-apps/plugin-opener';
import { showToast } from './Toast';
import { t } from '@/i18n';
import { sanitizePreviewHtml } from '@/utils/sanitizeHtml';

marked.setOptions({
  gfm: true,
  breaks: false,
});

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

function isExternalHref(href: string): boolean {
  const value = href.trim();
  if (!value || value.startsWith('#') || value.toLowerCase().startsWith('javascript:')) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:';
  } catch {
    return /^(https?:|mailto:)/i.test(value);
  }
}

async function openExternalLink(href: string): Promise<void> {
  try {
    await openUrl(href);
  } catch {
    try {
      const opened = window.open(href, '_blank', 'noopener,noreferrer');
      if (!opened) showToast(t('note.openLinkFailed'));
    } catch {
      showToast(t('note.openLinkFailed'));
    }
  }
}

function findPreviewAnchor(event: React.MouseEvent<HTMLElement>): HTMLAnchorElement | null {
  const anchor = (event.target as HTMLElement).closest('a');
  if (!anchor || !event.currentTarget.contains(anchor)) return null;
  return anchor;
}

/** Renders GFM markdown; raw HTML/CSS is kept after stripping scripts and event handlers. */
const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, className }) => {
  const html = useMemo(() => {
    const parsed = marked.parse(content ?? '', { async: false });
    return sanitizePreviewHtml(typeof parsed === 'string' ? parsed : '');
  }, [content]);

  const handleLinkNavigate = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const anchor = findPreviewAnchor(event);
    if (!anchor) return;

    const href = anchor.getAttribute('href')?.trim() ?? '';
    if (href.toLowerCase().startsWith('javascript:')) {
      event.preventDefault();
      return;
    }
    if (!isExternalHref(href)) return;

    event.preventDefault();
    void openExternalLink(href);
  }, []);

  const handleAuxClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (event.button !== 1) return;
    handleLinkNavigate(event);
  }, [handleLinkNavigate]);

  return (
    <article
      className={className ?? 'markdown-preview'}
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={handleLinkNavigate}
      onAuxClick={handleAuxClick}
    />
  );
};

export default MarkdownPreview;
