export interface CsvCellMatch {
  rowIndex: number;
  colIndex: number;
}

/** Literal, case-insensitive search across the entire grid, once per matching cell. */
export function findCsvCells(grid: string[][], query: string): CsvCellMatch[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const matches: CsvCellMatch[] = [];
  grid.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (value.toLowerCase().includes(needle)) matches.push({ rowIndex, colIndex });
    });
  });
  return matches;
}
