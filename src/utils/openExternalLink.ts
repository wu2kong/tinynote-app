import { openUrl } from '@tauri-apps/plugin-opener';
import { showToast } from '@/components/Toast';
import { t } from '@/i18n';

export function isExternalHref(href: string): boolean {
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

export async function openExternalLink(href: string): Promise<void> {
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
