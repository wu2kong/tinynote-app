/** Parse CSV text into a rectangular grid of cell strings. */
export function parseCsv(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];
    if (inQuotes) {
      if (c === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (c === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      continue;
    }
    field += c;
  }

  row.push(field);
  if (row.length > 1 || row[0] !== '' || rows.length === 0) {
    rows.push(row);
  }

  return normalizeCsvRows(rows);
}

export function normalizeCsvRows(rows: string[][]): string[][] {
  if (rows.length === 0) return [['']];
  const maxCols = Math.max(1, ...rows.map((r) => r.length));
  return rows.map((r) => {
    const copy = [...r];
    while (copy.length < maxCols) copy.push('');
    return copy;
  });
}

/** True when a cell must be wrapped in double quotes in CSV text. */
export function mustQuoteCsvField(field: string): boolean {
  return /[",\r\n\u2028\u2029]/.test(field);
}

/** Escape one cell for CSV storage (RFC 4180-style quoting). */
export function escapeCsvField(field: string): string {
  if (!mustQuoteCsvField(field)) return field;
  const escaped = field
    .replace(/"/g, '""')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  return `"${escaped}"`;
}

/** Serialize a grid to CSV text (LF record separator, trailing newline). */
export function serializeCsv(rows: string[][]): string {
  if (rows.length === 0) return '';
  return `${rows.map((row) => row.map(escapeCsvField).join(',')).join('\n')}\n`;
}

export function createInitialCsvContent(): string {
  return serializeCsv([
    ['Column 1', 'Column 2', 'Column 3'],
    ['', '', ''],
  ]);
}

export function moveCsvRow(rows: string[][], fromIndex: number, toIndex: number): string[][] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= rows.length || toIndex >= rows.length) {
    return rows;
  }
  const next = [...rows];
  const [row] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, row);
  return next;
}

export function moveCsvColumn(rows: string[][], fromIndex: number, toIndex: number): string[][] {
  const colCount = Math.max(0, ...rows.map((row) => row.length));
  if (
    fromIndex === toIndex
    || fromIndex < 0
    || toIndex < 0
    || fromIndex >= colCount
    || toIndex >= colCount
  ) {
    return rows;
  }
  return rows.map((row) => {
    const next = [...row];
    const [cell] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, cell);
    return next;
  });
}

export function ensureMinGrid(rows: string[][], minRows: number, minCols: number): string[][] {
  const colCount = Math.max(minCols, ...rows.map((r) => r.length), 1);
  const result = rows.map((r) => {
    const copy = [...r];
    while (copy.length < colCount) copy.push('');
    return copy;
  });
  while (result.length < minRows) {
    result.push(Array.from({ length: colCount }, () => ''));
  }
  return result;
}
