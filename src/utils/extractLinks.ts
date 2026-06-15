const HTTP_LINK_REGEX = /https?:\/\/[^\s<>"']+/gi;

export function extractHttpLinks(text: string): string[] {
  const matches = text.match(HTTP_LINK_REGEX);
  if (!matches) return [];

  const seen = new Set<string>();
  const links: string[] = [];

  for (const match of matches) {
    const url = match.replace(/[.,;:!?)]+$/, '');
    if (!seen.has(url)) {
      seen.add(url);
      links.push(url);
    }
  }

  return links;
}
