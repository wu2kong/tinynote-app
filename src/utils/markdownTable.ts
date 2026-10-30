import { normalizeCsvRows } from './csvTable.ts';

export class MarkdownTableParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarkdownTableParseError';
  }
}

function escapeMarkdownTableCell(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, '<br>');
}

function unescapeMarkdownTableCell(text: string): string {
  return text
    .trim()
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\\\|/g, '|')
    .replace(/\\\\/g, '\\');
}

function formatMarkdownTableRow(cells: string[]): string {
  return `| ${cells.map(escapeMarkdownTableCell).join(' | ')} |`;
}

/** Convert a CSV grid to a GitHub-flavored Markdown pipe table. */
export function gridToMarkdownTable(rows: string[][]): string {
  if (rows.length === 0) {
    return '| |\n| --- |\n';
  }
  const colCount = Math.max(1, ...rows.map((row) => row.length));
  const normalized = rows.map((row) => {
    const copy = [...row];
    while (copy.length < colCount) copy.push('');
    return copy;
  });
  const separator = `| ${Array.from({ length: colCount }, () => '---').join(' | ')} |`;
  return `${[
    formatMarkdownTableRow(normalized[0]),
    separator,
    ...normalized.slice(1).map(formatMarkdownTableRow),
  ].join('\n')}\n`;
}

function parseMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
    throw new MarkdownTableParseError('Table rows must start and end with |.');
  }
  const inner = trimmed.slice(1, -1);
  const cells: string[] = [];
  let cell = '';
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '\\' && inner[i + 1] === '|') {
      cell += '|';
      i++;
      continue;
    }
    if (c === '|') {
      cells.push(unescapeMarkdownTableCell(cell));
      cell = '';
      continue;
    }
    cell += c;
  }
  cells.push(unescapeMarkdownTableCell(cell));
  return cells;
}

function isMarkdownTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return false;
  return trimmed
    .slice(1, -1)
    .split('|')
    .every((part) => /^:?-{3,}:?$/.test(part.trim()));
}

/** Parse a Markdown pipe table into a CSV grid. */
export function parseMarkdownTable(text: string): string[][] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.includes('|'));

  if (lines.length < 2) {
    throw new MarkdownTableParseError('Markdown table must include a header row and a separator row.');
  }

  const parsedRows = lines.map((line) => parseMarkdownTableRow(line));
  const rows = isMarkdownTableSeparatorLine(lines[1])
    ? [parsedRows[0], ...parsedRows.slice(2)]
    : parsedRows;

  if (rows.length === 0) {
    throw new MarkdownTableParseError('Markdown table has no data rows.');
  }

  return normalizeCsvRows(rows);
}
