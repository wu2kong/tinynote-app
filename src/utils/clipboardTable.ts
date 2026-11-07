import { ensureMinGrid, normalizeCsvRows, parseTsv } from './csvTable.ts';
import { parseMarkdownTable } from './markdownTable.ts';

/** Read spreadsheet HTML in an inert document; never insert clipboard markup into the page. */
export function parseClipboardHtmlTable(html: string): string[][] | null {
  if (!html || typeof DOMParser === 'undefined') return null;
  const document = new DOMParser().parseFromString(html, 'text/html');
  const table = document.querySelector('table');
  if (!table) return null;
  const rows: string[][] = [];
  const occupied: boolean[][] = [];
  const sourceRows = Array.from(table.rows);
  sourceRows.forEach((row, ri) => {
    rows[ri] ??= [];
    occupied[ri] ??= [];
    let ci = 0;
    for (const cell of Array.from(row.cells)) {
      while (occupied[ri][ci]) ci++;
      // Preserve line breaks without depending on layout in the detached document.
      for (const br of Array.from(cell.querySelectorAll('br'))) br.replaceWith('\n');
      for (const unwanted of Array.from(cell.querySelectorAll('script, style'))) unwanted.remove();
      const text = (cell.textContent ?? '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ');
      const rowSpan = cell.rowSpan === 0 ? sourceRows.length - ri : Math.min(cell.rowSpan, sourceRows.length - ri);
      for (let dr = 0; dr < rowSpan; dr++) {
        rows[ri + dr] ??= [];
        occupied[ri + dr] ??= [];
        for (let dc = 0; dc < cell.colSpan; dc++) {
          occupied[ri + dr][ci + dc] = true;
          rows[ri + dr][ci + dc] = dr === 0 && dc === 0 ? text : '';
        }
      }
      ci += cell.colSpan;
    }
  });
  return rows.length ? normalizeCsvRows(rows.map((row) => Array.from(row, (cell) => cell ?? ''))) : null;
}

/** Return null for ordinary text so native single-cell paste keeps cursor/selection behavior. */
export function parseClipboardTable(text: string, html = ''): string[][] | null {
  const htmlRows = parseClipboardHtmlTable(html);
  if (htmlRows) return htmlRows;
  const lines = text.trim().split(/\r\n?|\n/);
  if (lines.length >= 2 && /^\|\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|$/.test(lines[1].trim())) {
    try {
      return parseMarkdownTable(text);
    } catch {
      // Fall back to plain text when clipboard contents are not a complete pipe table.
    }
  }
  if (!/[\t\r\n]/.test(text)) return null;
  const rows = parseTsv(text);
  return rows.length > 1 || rows[0].length > 1 ? rows : null;
}

/** Overwrite the pasted rectangle, expanding the grid and preserving surrounding cells. */
export function pasteTableAt(grid: string[][], pasted: string[][], rowIndex: number, colIndex: number): string[][] {
  const width = Math.max(0, ...pasted.map((row) => row.length));
  const next = ensureMinGrid(grid, rowIndex + pasted.length, colIndex + width);
  pasted.forEach((row, ri) => row.forEach((cell, ci) => {
    next[rowIndex + ri][colIndex + ci] = cell;
  }));
  return next;
}
