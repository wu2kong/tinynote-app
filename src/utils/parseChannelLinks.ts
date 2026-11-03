export interface ImportedChannelLink {
  url: string;
  title: string;
  note: string;
}

const URL_PATTERN = 'https?:\\/\\/[^\\s|<>]+';

export function parseChannelLinks(text: string): ImportedChannelLink[] {
  const result: ImportedChannelLink[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let title = '';
    let note = '';
    let url = '';
    const markdown = line.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)(?:\s*[-–—|]\s*(.*))?$/i);
    if (markdown) {
      [, title, url, note = ''] = markdown;
    } else {
      const pipe = line.match(new RegExp(`^(.*?)\\s*\\|\\s*(${URL_PATTERN})(?:\\s*\\|\\s*(.*))?$`, 'i'));
      const dash = line.match(new RegExp(`^(.*?)\\s+[-–—]\\s+(${URL_PATTERN})$`, 'i'));
      if (pipe) [, title, url, note = ''] = pipe;
      else if (dash) [, title, url] = dash;
      else if (/^https?:\/\/\S+$/i.test(line)) url = line;
      else continue;
    }
    try {
      const parsed = new URL(url);
      if (!title.trim()) title = parsed.hostname;
      result.push({ url, title: title.trim(), note: note.trim() });
    } catch { /* Skip malformed URLs. */ }
  }
  return result;
}
