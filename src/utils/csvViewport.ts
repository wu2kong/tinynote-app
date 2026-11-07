export type CsvRowSegment =
  | { kind: 'rows'; start: number; end: number }
  | { kind: 'spacer'; start: number; end: number; height: number };

/** Keep the first row for sticky headers and the focused row for uninterrupted editing. */
export function getCsvRowSegments(
  rowCount: number,
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  focusedRow: number | null = null,
  overscan = 8,
  pinnedRows: number[] = [],
): CsvRowSegment[] {
  if (rowCount <= 0) return [];
  const height = Math.max(1, rowHeight);
  const start = Math.min(rowCount - 1, Math.max(0, Math.floor(scrollTop / height) - overscan));
  const end = Math.min(rowCount, Math.max(start + 1, Math.ceil((scrollTop + viewportHeight) / height) + overscan));
  const ranges = [{ start: 0, end: 1 }, { start, end }];
  for (const row of pinnedRows) {
    if (row >= 0 && row < rowCount) ranges.push({ start: row, end: row + 1 });
  }
  if (focusedRow !== null && focusedRow >= 0 && focusedRow < rowCount) {
    // Neighbours preserve Tab / Shift+Tab order even after scrolling away from the editor.
    ranges.push({ start: Math.max(0, focusedRow - 1), end: Math.min(rowCount, focusedRow + 2) });
  }
  ranges.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  const segments: CsvRowSegment[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor) segments.push({ kind: 'spacer', start: cursor, end: range.start, height: (range.start - cursor) * height });
    segments.push({ kind: 'rows', ...range });
    cursor = range.end;
  }
  if (cursor < rowCount) segments.push({ kind: 'spacer', start: cursor, end: rowCount, height: (rowCount - cursor) * height });
  return segments;
}
