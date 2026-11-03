/** Find a web link under the caret, including the label of a Markdown link. */
export function findMindTextLinkAtOffset(text: string, offset: number): string | null {
  if (offset < 0 || offset > text.length) return null;
  const markdown = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi;
  for (const match of text.matchAll(markdown)) {
    const start = match.index ?? 0;
    if (offset >= start && offset <= start + match[0].length) return match[2];
  }
  const bare = /https?:\/\/[^\s<>]+/gi;
  for (const match of text.matchAll(bare)) {
    const start = match.index ?? 0;
    const href = match[0].replace(/[.,;:!?\])}]+$/, '');
    if (offset >= start && offset <= start + href.length) return href;
  }
  return null;
}

export function splitMindTextLinks(text: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = [];
  const pattern = /\[[^\]]+\]\((https?:\/\/[^\s)]+)\)|https?:\/\/[^\s<>]+/gi;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start) });
    const raw = match[0];
    const linked = match[1] ? raw : raw.replace(/[.,;:!?\])}]+$/, '');
    parts.push({ text: linked, href: match[1] ?? linked });
    last = start + linked.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
