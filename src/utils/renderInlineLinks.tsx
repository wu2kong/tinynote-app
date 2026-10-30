import type { ReactNode } from 'react';
import { isExternalHref, openExternalLink } from '@/utils/openExternalLink';

const INLINE_LINK_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?'")\]]|mailto:[^\s<]+)/gi;

export function renderInlineLinkText(text: string, linkClassName: string): ReactNode[] {
  if (!text) return [''];
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE_LINK_RE)) {
    const href = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }
    if (isExternalHref(href)) {
      parts.push(
        <a
          key={`${start}-${href}`}
          href={href}
          className={linkClassName}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void openExternalLink(href);
          }}
        >
          {href}
        </a>,
      );
    } else {
      parts.push(href);
    }
    lastIndex = start + href.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}
