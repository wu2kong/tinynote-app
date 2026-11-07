import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, PanelLeftClose, PanelLeftOpen,
  Search, SlidersHorizontal, Trash2, X,
} from 'lucide-react';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useStore } from '@/store/useStore';
import { useI18n } from '@/i18n/useI18n';
import { registerDocumentSaveFlusher } from '@/utils/documentSaveFlush';
import { moveCsvColumn, moveCsvRow, parseCsv, serializeCsv } from '@/utils/csvTable';
import { getCsvRowSegments } from '@/utils/csvViewport';
import { findCsvCells } from '@/utils/csvSearch';
import { parseClipboardTable, pasteTableAt } from '@/utils/clipboardTable';
import { gridToMarkdownTable, MarkdownTableParseError, parseMarkdownTable } from '@/utils/markdownTable';
import { isExternalHref, openExternalLink } from '@/utils/openExternalLink';
import ContextMenuPortal from './ContextMenuPortal';
import { showToast } from './Toast';

const CELL_LINK_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?'")\]]|mailto:[^\s<]+)/gi;

function renderCellLinkText(text: string): ReactNode[] {
  if (!text) return [''];
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(CELL_LINK_RE)) {
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
          className="csv-table-cell-link"
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

interface CsvTableCellProps {
  rowIndex: number;
  colIndex: number;
  value: string;
  linksClickable: boolean;
  onChange: (rowIndex: number, colIndex: number, value: string) => void;
  onPaste: (rowIndex: number, colIndex: number, event: React.ClipboardEvent<HTMLElement>) => void;
}

const CsvTableCell = memo(function CsvTableCell({ rowIndex, colIndex, value, linksClickable, onChange, onPaste }: CsvTableCellProps) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditing(false);
  }, [linksClickable]);

  useEffect(() => {
    if (editing && linksClickable) {
      textareaRef.current?.focus();
    }
  }, [editing, linksClickable]);

  if (editing || !linksClickable) {
    return (
      <textarea
        ref={textareaRef}
        className="csv-table-cell-input"
        rows={1}
        value={value}
        onChange={(e) => onChange(rowIndex, colIndex, e.target.value)}
        onPaste={(e) => onPaste(rowIndex, colIndex, e)}
        onBlur={() => {
          if (linksClickable) setEditing(false);
        }}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
      />
    );
  }

  return (
    <div
      className="csv-table-cell-link-preview"
      onPaste={(e) => onPaste(rowIndex, colIndex, e)}
      onClick={() => setEditing(true)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setEditing(true);
        }
      }}
      role="button"
      tabIndex={0}
    >
      {renderCellLinkText(value)}
    </div>
  );
});

const SAVE_DEBOUNCE_MS = 400;
const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_CANCEL_PX = 8;
const MIN_COLUMN_WIDTH_PX = 56;
const DEFAULT_COLUMN_WIDTH_PX = 120;

function measureColumnWidths(container: HTMLElement | null, colCount: number): number[] {
  const widths: number[] = [];
  for (let colIndex = 0; colIndex < colCount; colIndex++) {
    const header = container?.querySelector<HTMLElement>(`thead th[data-csv-col-index="${colIndex}"]`);
    const bodyCell = container?.querySelector<HTMLElement>(
      `tbody tr:first-child td[data-csv-col-index="${colIndex}"]`,
    );
    const width = header?.getBoundingClientRect().width ?? bodyCell?.getBoundingClientRect().width;
    widths.push(Math.max(MIN_COLUMN_WIDTH_PX, Math.round(width ?? DEFAULT_COLUMN_WIDTH_PX)));
  }
  return widths;
}

type CsvTableContextMenu =
  | { kind: 'row'; index: number; x: number; y: number }
  | { kind: 'column'; index: number; x: number; y: number };

type CsvAxisDragState = {
  axis: 'row' | 'column';
  fromIndex: number;
  overIndex: number;
};

type PendingHeaderPress = {
  axis: 'row' | 'column';
  index: number;
  pointerId: number;
  startX: number;
  startY: number;
};

function resolveAxisDropIndex(
  container: HTMLElement | null,
  axis: 'row' | 'column',
  clientX: number,
  clientY: number,
  fallback: number,
): number {
  if (!container) return fallback;
  const selector = axis === 'column'
    ? 'thead th[data-csv-col-index]'
    : 'tbody tr[data-csv-row-index]';
  const attr = axis === 'column' ? 'data-csv-col-index' : 'data-csv-row-index';
  const nodes = container.querySelectorAll<HTMLElement>(selector);
  for (const node of nodes) {
    const index = Number(node.getAttribute(attr));
    if (Number.isNaN(index)) continue;
    const rect = node.getBoundingClientRect();
    if (axis === 'column') {
      if (clientX >= rect.left && clientX <= rect.right) return index;
    } else if (clientY >= rect.top && clientY <= rect.bottom) {
      return index;
    }
  }
  return fallback;
}

const CsvNotebookPanel: React.FC = () => {
  const { t } = useI18n();
  const currentNotebook = useStore((s) => s.currentNotebook);
  const showDirectoryPanel = useStore((s) => s.showDirectoryPanel);
  const showAppBar = useStore((s) => s.showAppBar);
  const toggleDirectoryPanel = useStore((s) => s.toggleDirectoryPanel);
  const updateNotebookContent = useStore((s) => s.updateNotebookContent);

  const [grid, setGrid] = useState<string[][]>([['']]);
  const [contextMenu, setContextMenu] = useState<CsvTableContextMenu | null>(null);
  const [axisDrag, setAxisDrag] = useState<CsvAxisDragState | null>(null);
  const [longPressIndex, setLongPressIndex] = useState<{ axis: 'row' | 'column'; index: number } | null>(null);
  const [adaptiveRowHeight, setAdaptiveRowHeight] = useState(false);
  const [adaptiveColumnWidth, setAdaptiveColumnWidth] = useState(false);
  const [showRowNumbers, setShowRowNumbers] = useState(true);
  const [showColumnNumbers, setShowColumnNumbers] = useState(true);
  const [linksClickable, setLinksClickable] = useState(false);
  const [freezeHeaderRow, setFreezeHeaderRow] = useState(false);
  const [freezeHeaderColumn, setFreezeHeaderColumn] = useState(false);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [importMarkdownOpen, setImportMarkdownOpen] = useState(false);
  const [importMarkdownText, setImportMarkdownText] = useState('');
  const [columnWidths, setColumnWidths] = useState<number[] | null>(null);
  const [isResizingColumn, setIsResizingColumn] = useState(false);
  const [viewport, setViewport] = useState({ top: 0, height: 600, rowHeight: 40 });
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const [searchText, setSearchText] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [searchNavigation, setSearchNavigation] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchQuery = searchText.trim().toLowerCase();
  const searchMatches = useMemo(() => findCsvCells(grid, searchQuery), [grid, searchQuery]);
  const activeSearchIndex = Math.min(searchIndex, Math.max(0, searchMatches.length - 1));
  const activeMatch = searchMatches[activeSearchIndex];
  const matchingCells = useMemo(() => new Set(searchMatches.map(({ rowIndex, colIndex }) => `${rowIndex}:${colIndex}`)), [searchMatches]);
  const moveSearch = (direction: number) => {
    if (searchMatches.length === 0) return;
    setSearchIndex((activeSearchIndex + direction + searchMatches.length) % searchMatches.length);
    setSearchNavigation((value) => value + 1);
  };

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const columnWidthsByNotebookRef = useRef<Map<string, number[] | null>>(new Map());
  const columnWidthsRef = useRef<number[] | null>(null);
  columnWidthsRef.current = columnWidths;
  const columnResizeRef = useRef<{
    colIndex: number;
    startX: number;
    startWidth: number;
    baseline: number[];
  } | null>(null);
  const layoutMenuRef = useRef<HTMLDivElement>(null);
  const notebookPathRef = useRef<string | null>(null);
  const gridRef = useRef(grid);
  gridRef.current = grid;
  const colCount = useMemo(() => grid.reduce((count, row) => Math.max(count, row.length), 1), [grid]);
  const updateNotebookContentRef = useRef(updateNotebookContent);
  updateNotebookContentRef.current = updateNotebookContent;
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const pendingPressRef = useRef<PendingHeaderPress | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const axisDragRef = useRef(axisDrag);
  axisDragRef.current = axisDrag;
  const suppressContextMenuRef = useRef(false);
  // Intrinsic row heights / column widths still need all rows for native table sizing.
  const virtualizeRows = grid.length > 100 && !adaptiveRowHeight && !adaptiveColumnWidth;
  const rowSegments = useMemo(() => virtualizeRows
    ? getCsvRowSegments(grid.length, viewport.top, viewport.height, viewport.rowHeight, focusedRow, 8, activeMatch ? [activeMatch.rowIndex] : [])
    : [{ kind: 'rows' as const, start: 0, end: grid.length }],
  [virtualizeRows, grid.length, viewport, focusedRow, activeMatch?.rowIndex]);

  useLayoutEffect(() => {
    const container = tableScrollRef.current;
    if (!container) return;
    container.scrollTop = 0;
    setFocusedRow(null);
    setSearchText('');
    setSearchIndex(0);
    setViewport((prev) => ({ ...prev, top: 0 }));
  }, [currentNotebook?.path]);

  useLayoutEffect(() => {
    const container = tableScrollRef.current;
    if (!container || !virtualizeRows) return;
    const update = () => {
      // Rects include the app's CSS zoom; scrollTop/clientHeight use layout pixels.
      const zoom = Number(getComputedStyle(document.documentElement).zoom) || 1;
      const row = container.querySelector('tbody tr[data-csv-row-index]');
      const headerHeight = (container.querySelector('thead')?.getBoundingClientRect().height ?? 0) / zoom;
      const next = {
        top: Math.max(0, container.scrollTop - headerHeight),
        height: container.clientHeight,
        rowHeight: (row?.getBoundingClientRect().height ?? 0) / zoom || 40,
      };
      setViewport((prev) => prev.top === next.top && prev.height === next.height && prev.rowHeight === next.rowHeight ? prev : next);
    };
    update();
    container.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(container);
    const row = container.querySelector('tbody tr[data-csv-row-index]');
    if (row) observer.observe(row);
    return () => {
      container.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [virtualizeRows, currentNotebook?.path, showColumnNumbers]);

  useLayoutEffect(() => {
    const container = tableScrollRef.current;
    if (!container || !activeMatch) return;
    const cell = container.querySelector<HTMLElement>(
      `tr[data-csv-row-index="${activeMatch.rowIndex}"] td[data-csv-col-index="${activeMatch.colIndex}"]`,
    );
    if (!cell) return;
    const zoom = Number(getComputedStyle(document.documentElement).zoom) || 1;
    const bounds = container.getBoundingClientRect();
    const rect = cell.getBoundingClientRect();
    const headerHeight = container.querySelector('thead')?.getBoundingClientRect().height ?? 0;
    const frozenRowHeight = freezeHeaderRow && activeMatch.rowIndex !== 0
      ? container.querySelector('tr[data-csv-row-index="0"]')?.getBoundingClientRect().height ?? 0 : 0;
    const rowNumberWidth = container.querySelector('.csv-table-row-header')?.getBoundingClientRect().width ?? 0;
    const frozenColumnWidth = freezeHeaderColumn && activeMatch.colIndex !== 0
      ? container.querySelector('td[data-csv-col-index="0"]')?.getBoundingClientRect().width ?? 0 : 0;
    const top = bounds.top + headerHeight + frozenRowHeight;
    const left = bounds.left + rowNumberWidth + frozenColumnWidth;
    const bottom = bounds.top + container.clientHeight * zoom;
    const right = bounds.left + container.clientWidth * zoom;
    // Scroll this pane only, keeping search input focus and accounting for sticky titles.
    if (rect.top < top || rect.bottom > bottom) {
      container.scrollTop += (rect.top - top - Math.max(0, (bottom - top - rect.height) / 2)) / zoom;
    }
    if (rect.left < left || rect.right > right) {
      container.scrollLeft += (rect.left - left - Math.max(0, (right - left - rect.width) / 2)) / zoom;
    }
    if (virtualizeRows) {
      setViewport((prev) => ({ ...prev, top: Math.max(0, container.scrollTop - headerHeight / zoom) }));
    }
  }, [searchQuery, searchNavigation, activeMatch?.rowIndex, activeMatch?.colIndex, virtualizeRows, viewport.rowHeight, freezeHeaderRow, freezeHeaderColumn, showRowNumbers, showColumnNumbers]);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pendingPressRef.current = null;
    setLongPressIndex(null);
  }, []);

  const flushPendingSave = useCallback((): Promise<void> => {
    if (!saveTimerRef.current) return Promise.resolve();
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    const path = notebookPathRef.current;
    if (!path) return Promise.resolve();
    return updateNotebookContentRef.current(serializeCsv(gridRef.current), path);
  }, []);

  const flushPendingSaveRef = useRef(flushPendingSave);
  flushPendingSaveRef.current = flushPendingSave;

  const scheduleSave = useCallback((nextGrid: string[][]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      const path = notebookPathRef.current;
      if (!path) return;
      void updateNotebookContentRef.current(serializeCsv(nextGrid), path);
    }, SAVE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (!currentNotebook || currentNotebook.format !== 'csv') return;
    const content = currentNotebook.content ?? '';

    if (notebookPathRef.current !== currentNotebook.path) {
      const previousPath = notebookPathRef.current;
      if (previousPath) {
        columnWidthsByNotebookRef.current.set(previousPath, columnWidthsRef.current);
      }
      notebookPathRef.current = currentNotebook.path;
      setGrid(parseCsv(content));
      setColumnWidths(columnWidthsByNotebookRef.current.get(currentNotebook.path) ?? null);
      setContextMenu(null);
      setAxisDrag(null);
      clearLongPress();
      columnResizeRef.current = null;
      setIsResizingColumn(false);
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      return;
    }

    if (saveTimerRef.current) return;

    const normalizedLocal = serializeCsv(gridRef.current);
    if (content === normalizedLocal) return;
    const remoteGrid = parseCsv(content);
    const normalizedRemote = serializeCsv(remoteGrid);
    if (normalizedRemote !== normalizedLocal) {
      setGrid(remoteGrid);
    }
  }, [clearLongPress, currentNotebook?.path, currentNotebook?.content, currentNotebook?.format]);

  useEffect(() => registerDocumentSaveFlusher(() => flushPendingSaveRef.current()), []);

  useEffect(() => () => {
    void flushPendingSaveRef.current();
  }, [currentNotebook?.path]);

  useEffect(() => {
    if (!axisDrag) return;

    const onPointerMove = (event: PointerEvent) => {
      const drag = axisDragRef.current;
      if (!drag) return;
      const overIndex = resolveAxisDropIndex(
        tableScrollRef.current,
        drag.axis,
        event.clientX,
        event.clientY,
        drag.overIndex,
      );
      if (overIndex !== drag.overIndex) {
        setAxisDrag({ ...drag, overIndex });
      }
    };

    const finishDrag = () => {
      const drag = axisDragRef.current;
      if (!drag) return;
      if (drag.fromIndex !== drag.overIndex) {
        setGrid((prev) => {
          const next = drag.axis === 'row'
            ? moveCsvRow(prev, drag.fromIndex, drag.overIndex)
            : moveCsvColumn(prev, drag.fromIndex, drag.overIndex);
          scheduleSave(next);
          return next;
        });
      }
      suppressContextMenuRef.current = true;
      window.setTimeout(() => {
        suppressContextMenuRef.current = false;
      }, 400);
      setAxisDrag(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  }, [axisDrag, scheduleSave]);

  useEffect(() => () => clearLongPress(), [clearLongPress]);

  useEffect(() => {
    if (!currentNotebook || currentNotebook.format !== 'csv') return;
    setColumnWidths((prev) => {
      if (!prev) return null;
      if (prev.length === colCount) return prev;
      if (prev.length < colCount) {
        return [
          ...prev,
          ...Array.from({ length: colCount - prev.length }, () => DEFAULT_COLUMN_WIDTH_PX),
        ];
      }
      return prev.slice(0, colCount);
    });
  }, [colCount, currentNotebook?.format, currentNotebook?.path]);

  useEffect(() => {
    if (!isResizingColumn) return;

    const onPointerMove = (event: PointerEvent) => {
      const resize = columnResizeRef.current;
      if (!resize) return;
      const nextWidth = Math.max(
        MIN_COLUMN_WIDTH_PX,
        Math.round(resize.startWidth + (event.clientX - resize.startX)),
      );
      const next = [...resize.baseline];
      next[resize.colIndex] = nextWidth;
      setColumnWidths(next);
    };

    const finishResize = () => {
      const path = notebookPathRef.current;
      if (path) {
        columnWidthsByNotebookRef.current.set(path, columnWidthsRef.current);
      }
      columnResizeRef.current = null;
      setIsResizingColumn(false);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', finishResize);
    window.addEventListener('pointercancel', finishResize);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finishResize);
      window.removeEventListener('pointercancel', finishResize);
    };
  }, [isResizingColumn]);

  useEffect(() => {
    if (!layoutMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!layoutMenuRef.current?.contains(event.target as Node)) {
        setLayoutMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [layoutMenuOpen]);

  const patchGrid = useCallback((updater: (prev: string[][]) => string[][]) => {
    setGrid((prev) => {
      const next = updater(prev);
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const handleCellChange = useCallback((rowIndex: number, colIndex: number, value: string) => {
    patchGrid((prev) => {
      const next = [...prev];
      next[rowIndex] = [...prev[rowIndex]];
      next[rowIndex][colIndex] = value;
      return next;
    });
  }, [patchGrid]);

  const handleCellPaste = useCallback((rowIndex: number, colIndex: number, event: React.ClipboardEvent<HTMLElement>) => {
    const pasted = parseClipboardTable(
      event.clipboardData.getData('text/plain'),
      event.clipboardData.getData('text/html'),
    );
    if (!pasted) return;
    event.preventDefault();
    patchGrid((prev) => pasteTableAt(prev, pasted, rowIndex, colIndex));
  }, [patchGrid]);

  const insertRowAt = (atIndex: number) => {
    patchGrid((prev) => {
      const colCount = Math.max(1, ...prev.map((r) => r.length));
      const newRow = Array.from({ length: colCount }, () => '');
      const next = [...prev];
      next.splice(atIndex, 0, newRow);
      return next;
    });
  };

  const insertColumnAt = (atIndex: number) => {
    patchGrid((prev) => prev.map((row) => {
      const next = [...row];
      next.splice(atIndex, 0, '');
      return next;
    }));
  };

  const handleDeleteRow = (rowIndex: number) => {
    patchGrid((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== rowIndex);
    });
  };

  const handleDeleteColumn = (colIndex: number) => {
    patchGrid((prev) => {
      const colCount = Math.max(1, ...prev.map((r) => r.length));
      if (colCount <= 1) return prev;
      return prev.map((row) => row.filter((_, i) => i !== colIndex));
    });
  };

  const startAxisDrag = useCallback((axis: 'row' | 'column', index: number) => {
    clearLongPress();
    setContextMenu(null);
    setAxisDrag({ axis, fromIndex: index, overIndex: index });
  }, [clearLongPress]);

  const handleHeaderPointerDown = (
    axis: 'row' | 'column',
    index: number,
    event: React.PointerEvent<HTMLElement>,
  ) => {
    if (event.button !== 0 || axisDrag) return;
    clearLongPress();
    pendingPressRef.current = {
      axis,
      index,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      const pending = pendingPressRef.current;
      pendingPressRef.current = null;
      if (!pending || pending.index !== index || pending.axis !== axis) return;
      setLongPressIndex(null);
      startAxisDrag(axis, index);
    }, LONG_PRESS_MS);
    setLongPressIndex({ axis, index });
  };

  const handleHeaderPointerMove = (
    axis: 'row' | 'column',
    index: number,
    event: React.PointerEvent<HTMLElement>,
  ) => {
    const pending = pendingPressRef.current;
    if (!pending || pending.axis !== axis || pending.index !== index || pending.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - pending.startX;
    const dy = event.clientY - pending.startY;
    if (Math.hypot(dx, dy) >= LONG_PRESS_MOVE_CANCEL_PX) {
      clearLongPress();
    }
  };

  const handleHeaderPointerUp = () => {
    if (!axisDrag) clearLongPress();
  };

  const openRowContextMenu = (e: React.MouseEvent, rowIndex: number) => {
    if (suppressContextMenuRef.current || axisDrag) return;
    e.preventDefault();
    setContextMenu({ kind: 'row', index: rowIndex, x: e.clientX, y: e.clientY });
  };

  const openColumnContextMenu = (e: React.MouseEvent, colIndex: number) => {
    if (suppressContextMenuRef.current || axisDrag) return;
    e.preventDefault();
    setContextMenu({ kind: 'column', index: colIndex, x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  const copyGridAsMarkdown = async () => {
    const markdown = gridToMarkdownTable(gridRef.current);
    setLayoutMenuOpen(false);
    try {
      await writeText(markdown);
      showToast(t('csvEditor.copyMarkdownSuccess'));
    } catch {
      try {
        await navigator.clipboard.writeText(markdown);
        showToast(t('csvEditor.copyMarkdownSuccess'));
      } catch {
        showToast(t('csvEditor.copyMarkdownFailed'));
      }
    }
  };

  const openImportMarkdownModal = () => {
    setLayoutMenuOpen(false);
    setImportMarkdownText('');
    setImportMarkdownOpen(true);
  };

  const handleColumnResizeStart = (colIndex: number, event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    clearLongPress();
    const baseline = columnWidthsRef.current
      ?? measureColumnWidths(tableScrollRef.current, colCount);
    const startWidth = baseline[colIndex] ?? DEFAULT_COLUMN_WIDTH_PX;
    columnResizeRef.current = {
      colIndex,
      startX: event.clientX,
      startWidth,
      baseline,
    };
    setColumnWidths(baseline);
    setIsResizingColumn(true);
  };

  const renderColumnResizeHandle = (colIndex: number) => (
    <span
      className="csv-table-col-resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label={t('csvEditor.resizeColumn')}
      onPointerDown={(event) => handleColumnResizeStart(colIndex, event)}
      onClick={(event) => event.stopPropagation()}
    />
  );

  const submitImportMarkdown = () => {
    try {
      const nextGrid = parseMarkdownTable(importMarkdownText);
      patchGrid(() => nextGrid);
      setImportMarkdownOpen(false);
      setImportMarkdownText('');
      showToast(t('csvEditor.importMarkdownSuccess'));
    } catch (error) {
      const detail = error instanceof MarkdownTableParseError
        ? error.message
        : error instanceof Error
          ? error.message
          : '';
      showToast(detail ? `${t('csvEditor.importMarkdownFailed')}: ${detail}` : t('csvEditor.importMarkdownFailed'));
    }
  };

  const colHeaderClass = (colIndex: number) => {
    const classes = ['csv-table-col-header'];
    if (axisDrag?.axis === 'column') {
      if (axisDrag.fromIndex === colIndex) classes.push('csv-table-axis-source');
      if (axisDrag.overIndex === colIndex && axisDrag.fromIndex !== colIndex) {
        classes.push('csv-table-axis-drop-target');
      }
    }
    if (longPressIndex?.axis === 'column' && longPressIndex.index === colIndex) {
      classes.push('csv-table-header-long-press');
    }
    return classes.join(' ');
  };

  const rowHeaderClass = (rowIndex: number) => {
    const classes = ['csv-table-row-header'];
    if (rowIndex === 0) classes.push('csv-table-title-row-cell');
    if (axisDrag?.axis === 'row') {
      if (axisDrag.fromIndex === rowIndex) classes.push('csv-table-axis-source');
      if (axisDrag.overIndex === rowIndex && axisDrag.fromIndex !== rowIndex) {
        classes.push('csv-table-axis-drop-target');
      }
    }
    if (longPressIndex?.axis === 'row' && longPressIndex.index === rowIndex) {
      classes.push('csv-table-header-long-press');
    }
    return classes.join(' ');
  };

  const rowClass = (rowIndex: number) => {
    const classes: string[] = [];
    if (axisDrag?.axis === 'row') {
      if (axisDrag.fromIndex === rowIndex) classes.push('csv-table-row-source');
      if (axisDrag.overIndex === rowIndex && axisDrag.fromIndex !== rowIndex) {
        classes.push('csv-table-row-drop-target');
      }
    }
    return classes.join(' ');
  };

  const cellClass = (rowIndex: number, colIndex: number) => {
    const classes: string[] = [];
    if (matchingCells.has(`${rowIndex}:${colIndex}`)) classes.push('csv-table-search-match');
    if (activeMatch?.rowIndex === rowIndex && activeMatch.colIndex === colIndex) classes.push('csv-table-search-active');
    if (rowIndex === 0) classes.push('csv-table-title-row-cell');
    if (colIndex === 0) classes.push('csv-table-title-col-cell');
    if (axisDrag?.axis === 'column') {
      if (axisDrag.fromIndex === colIndex) classes.push('csv-table-col-source');
      if (axisDrag.overIndex === colIndex && axisDrag.fromIndex !== colIndex) {
        classes.push('csv-table-col-drop-target');
      }
    }
    return classes.join(' ');
  };

  if (!currentNotebook || currentNotebook.format !== 'csv') {
    return (
      <div className="csv-notebook-panel">
        <div className="csv-notebook-empty">{t('note.selectNotebook')}</div>
      </div>
    );
  }

  const leftPanelVisible = showDirectoryPanel || showAppBar;
  const isDraggingAxis = axisDrag != null;
  const tableLayoutClass = [
    adaptiveRowHeight ? 'csv-table-adaptive-rows' : 'csv-table-equal-rows',
    adaptiveColumnWidth ? 'csv-table-adaptive-cols' : 'csv-table-equal-cols',
    showRowNumbers ? 'csv-table-has-row-numbers' : 'csv-table-hide-row-numbers',
    showColumnNumbers ? 'csv-table-has-col-headers' : 'csv-table-hide-column-numbers',
    freezeHeaderRow ? 'csv-table-freeze-header-row' : '',
    freezeHeaderColumn ? 'csv-table-freeze-header-col' : '',
    columnWidths ? 'csv-table-custom-col-widths' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={`csv-notebook-panel${isDraggingAxis ? ' csv-notebook-axis-dragging' : ''}${isResizingColumn ? ' csv-notebook-col-resizing' : ''}`}
      onKeyDownCapture={(event) => {
        if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'f' && !importMarkdownOpen) {
          event.preventDefault();
          event.stopPropagation();
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }
      }}
    >
      <div className="csv-notebook-header">
        <div className="csv-notebook-header-left">
          <button
            className="left-panel-toggle"
            onClick={toggleDirectoryPanel}
            title={leftPanelVisible ? t('app.hideSidebar') : t('app.showSidebar')}
          >
            {leftPanelVisible ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          <div className="csv-notebook-title-wrap">
            <h3>{currentNotebook.name}</h3>
            <span className="csv-notebook-format-badge">{t('directory.formats.csv')}</span>
          </div>
        </div>
        <div className="csv-notebook-toolbar">
          <div className="csv-layout-menu-wrap" ref={layoutMenuRef}>
            <button
              type="button"
              className={`btn btn-sm csv-layout-menu-trigger${layoutMenuOpen ? ' open' : ''}`}
              onClick={() => setLayoutMenuOpen((open) => !open)}
              aria-expanded={layoutMenuOpen}
              aria-haspopup="menu"
              title={t('csvEditor.optionsMenu')}
            >
              <SlidersHorizontal size={14} />
              {t('csvEditor.optionsMenu')}
              <ChevronDown size={14} className="csv-layout-menu-chevron" />
            </button>
            {layoutMenuOpen && (
              <div className="csv-layout-menu" role="menu">
                <label className="csv-layout-menu-item">
                  <input
                    type="checkbox"
                    checked={adaptiveRowHeight}
                    onChange={(e) => setAdaptiveRowHeight(e.target.checked)}
                  />
                  <span>{t('csvEditor.adaptiveRowHeight')}</span>
                </label>
                <label className="csv-layout-menu-item">
                  <input
                    type="checkbox"
                    checked={adaptiveColumnWidth}
                    onChange={(e) => setAdaptiveColumnWidth(e.target.checked)}
                  />
                  <span>{t('csvEditor.adaptiveColumnWidth')}</span>
                </label>
                <label className="csv-layout-menu-item">
                  <input
                    type="checkbox"
                    checked={showRowNumbers}
                    onChange={(e) => setShowRowNumbers(e.target.checked)}
                  />
                  <span>{t('csvEditor.showRowNumbers')}</span>
                </label>
                <label className="csv-layout-menu-item">
                  <input
                    type="checkbox"
                    checked={showColumnNumbers}
                    onChange={(e) => setShowColumnNumbers(e.target.checked)}
                  />
                  <span>{t('csvEditor.showColumnNumbers')}</span>
                </label>
                <label className="csv-layout-menu-item">
                  <input
                    type="checkbox"
                    checked={linksClickable}
                    onChange={(e) => setLinksClickable(e.target.checked)}
                  />
                  <span>{t('csvEditor.linksClickable')}</span>
                </label>
                <label className="csv-layout-menu-item">
                  <input
                    type="checkbox"
                    checked={freezeHeaderRow}
                    onChange={(e) => setFreezeHeaderRow(e.target.checked)}
                  />
                  <span>{t('csvEditor.freezeHeaderRow')}</span>
                </label>
                <label className="csv-layout-menu-item">
                  <input
                    type="checkbox"
                    checked={freezeHeaderColumn}
                    onChange={(e) => setFreezeHeaderColumn(e.target.checked)}
                  />
                  <span>{t('csvEditor.freezeHeaderColumn')}</span>
                </label>
                <div className="csv-layout-menu-divider" />
                <button type="button" className="csv-layout-menu-action" onClick={() => void copyGridAsMarkdown()}>
                  {t('csvEditor.copyAsMarkdown')}
                </button>
                <button type="button" className="csv-layout-menu-action" onClick={openImportMarkdownModal}>
                  {t('csvEditor.importMarkdownOverwrite')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="csv-search-bar" role="search" aria-label={t('csvEditor.searchPlaceholder')}>
        <Search size={15} aria-hidden="true" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchText}
          placeholder={t('csvEditor.searchPlaceholder')}
          aria-label={t('csvEditor.searchPlaceholder')}
          onChange={(event) => { setSearchText(event.target.value); setSearchIndex(0); }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Enter') {
              event.preventDefault();
              moveSearch(event.shiftKey ? -1 : 1);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              setSearchText('');
              setSearchIndex(0);
            }
          }}
        />
        <span className="csv-search-count" role="status" aria-live="polite">
          {searchQuery && (searchMatches.length
            ? t('csvEditor.searchCount', { current: activeSearchIndex + 1, total: searchMatches.length })
            : t('search.noResults'))}
        </span>
        <button type="button" className="csv-search-button" disabled={!searchMatches.length}
          title={t('csvEditor.previousMatch')} aria-label={t('csvEditor.previousMatch')} onClick={() => moveSearch(-1)}>
          <ArrowUp size={15} />
        </button>
        <button type="button" className="csv-search-button" disabled={!searchMatches.length}
          title={t('csvEditor.nextMatch')} aria-label={t('csvEditor.nextMatch')} onClick={() => moveSearch(1)}>
          <ArrowDown size={15} />
        </button>
        {searchText && <button type="button" className="csv-search-button" title={t('search.clear')} aria-label={t('search.clear')}
          onClick={() => { setSearchText(''); setSearchIndex(0); searchInputRef.current?.focus(); }}>
          <X size={15} />
        </button>}
      </div>

      {importMarkdownOpen && (
        <div className="modal-overlay" onClick={() => setImportMarkdownOpen(false)}>
          <div className="modal csv-markdown-import-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{t('csvEditor.importMarkdownTitle')}</h3>
            <p className="modal-hint">{t('csvEditor.importMarkdownHint')}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitImportMarkdown();
              }}
            >
              <textarea
                className="modal-textarea csv-markdown-import-textarea"
                placeholder={t('csvEditor.importMarkdownPlaceholder')}
                value={importMarkdownText}
                onChange={(e) => setImportMarkdownText(e.target.value)}
                autoFocus
                spellCheck={false}
              />
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setImportMarkdownOpen(false)}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={!importMarkdownText.trim()}>
                  {t('common.confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="csv-notebook-body">
        <div className="csv-table-scroll" ref={tableScrollRef}
          onFocusCapture={(event) => {
            const row = (event.target as HTMLElement).closest('tr[data-csv-row-index]');
            setFocusedRow(row ? Number(row.getAttribute('data-csv-row-index')) : null);
          }}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusedRow(null);
          }}
        >
          <table className={`csv-table ${tableLayoutClass}`} aria-rowcount={grid.length + (showColumnNumbers ? 1 : 0)}>
            <colgroup>
              {showRowNumbers && <col className="csv-table-corner-col" />}
              {Array.from({ length: colCount }, (_, colIndex) => (
                <col
                  key={colIndex}
                  className="csv-table-data-col"
                  style={columnWidths?.[colIndex] ? { width: `${columnWidths[colIndex]}px` } : undefined}
                />
              ))}
            </colgroup>
            {showColumnNumbers && (
              <thead>
                <tr>
                  {showRowNumbers && <th className="csv-table-corner" aria-hidden="true" />}
                  {Array.from({ length: colCount }, (_, colIndex) => (
                    <th
                      key={colIndex}
                      className={colHeaderClass(colIndex)}
                      data-csv-col-index={colIndex}
                      title={t('csvEditor.reorderColumnHint')}
                      onPointerDown={(e) => handleHeaderPointerDown('column', colIndex, e)}
                      onPointerMove={(e) => handleHeaderPointerMove('column', colIndex, e)}
                      onPointerUp={handleHeaderPointerUp}
                      onPointerCancel={handleHeaderPointerUp}
                      onContextMenu={(e) => openColumnContextMenu(e, colIndex)}
                    >
                      <span className="csv-table-col-label">{colIndex + 1}</span>
                      {renderColumnResizeHandle(colIndex)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rowSegments.flatMap((segment) => segment.kind === 'spacer'
                ? [<tr key={`spacer-${segment.start}`} className="csv-table-spacer" aria-hidden="true" style={{ height: segment.height }}>
                    <td colSpan={colCount + (showRowNumbers ? 1 : 0)} style={{ height: segment.height }} />
                  </tr>]
                : Array.from({ length: segment.end - segment.start }, (_, offset) => {
                  const rowIndex = segment.start + offset;
                  const row = grid[rowIndex];
                  return (
                    <tr key={rowIndex} className={rowClass(rowIndex)} data-csv-row-index={rowIndex} aria-rowindex={rowIndex + (showColumnNumbers ? 2 : 1)}>
                      {showRowNumbers && (
                        <th
                          className={rowHeaderClass(rowIndex)}
                          data-csv-row-index={rowIndex}
                          title={t('csvEditor.reorderRowHint')}
                          onPointerDown={(e) => handleHeaderPointerDown('row', rowIndex, e)}
                          onPointerMove={(e) => handleHeaderPointerMove('row', rowIndex, e)}
                          onPointerUp={handleHeaderPointerUp}
                          onPointerCancel={handleHeaderPointerUp}
                          onContextMenu={(e) => openRowContextMenu(e, rowIndex)}
                        >
                          <span className="csv-table-row-label">{rowIndex + 1}</span>
                        </th>
                      )}
                      {Array.from({ length: colCount }, (_, colIndex) => (
                        <td
                          key={colIndex}
                          className={cellClass(rowIndex, colIndex)}
                          data-csv-col-index={colIndex}
                        >
                          {!showColumnNumbers && rowIndex === 0 && renderColumnResizeHandle(colIndex)}
                          <CsvTableCell
                            rowIndex={rowIndex}
                            colIndex={colIndex}
                            value={row[colIndex] ?? ''}
                            linksClickable={linksClickable}
                            onChange={handleCellChange}
                            onPaste={handleCellPaste}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                }))}
            </tbody>
          </table>
        </div>
      </div>

      {contextMenu?.kind === 'column' && (
        <ContextMenuPortal x={contextMenu.x} y={contextMenu.y} onClose={closeContextMenu}>
          <button
            type="button"
            className="context-menu-item"
            onClick={() => {
              insertColumnAt(contextMenu.index);
              closeContextMenu();
            }}
          >
            <ArrowLeft size={14} />
            {t('csvEditor.insertColumnLeft')}
          </button>
          <button
            type="button"
            className="context-menu-item"
            onClick={() => {
              insertColumnAt(contextMenu.index + 1);
              closeContextMenu();
            }}
          >
            <ArrowRight size={14} />
            {t('csvEditor.insertColumnRight')}
          </button>
          <div className="context-menu-divider" />
          <button
            type="button"
            className="context-menu-item danger"
            disabled={colCount <= 1}
            onClick={() => {
              if (colCount <= 1) return;
              handleDeleteColumn(contextMenu.index);
              closeContextMenu();
            }}
          >
            <Trash2 size={14} />
            {t('csvEditor.deleteColumn')}
          </button>
        </ContextMenuPortal>
      )}

      {contextMenu?.kind === 'row' && (
        <ContextMenuPortal x={contextMenu.x} y={contextMenu.y} onClose={closeContextMenu}>
          <button
            type="button"
            className="context-menu-item"
            onClick={() => {
              insertRowAt(contextMenu.index);
              closeContextMenu();
            }}
          >
            <ArrowUp size={14} />
            {t('csvEditor.insertRowAbove')}
          </button>
          <button
            type="button"
            className="context-menu-item"
            onClick={() => {
              insertRowAt(contextMenu.index + 1);
              closeContextMenu();
            }}
          >
            <ArrowDown size={14} />
            {t('csvEditor.insertRowBelow')}
          </button>
          <div className="context-menu-divider" />
          <button
            type="button"
            className="context-menu-item danger"
            disabled={grid.length <= 1}
            onClick={() => {
              if (grid.length <= 1) return;
              handleDeleteRow(contextMenu.index);
              closeContextMenu();
            }}
          >
            <Trash2 size={14} />
            {t('csvEditor.deleteRow')}
          </button>
        </ContextMenuPortal>
      )}
    </div>
  );
};

export default CsvNotebookPanel;
