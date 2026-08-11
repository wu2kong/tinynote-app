import { markdown } from '@codemirror/lang-markdown';
import { json } from '@codemirror/lang-json';
import { sql } from '@codemirror/lang-sql';
import { python } from '@codemirror/lang-python';
import { yaml } from '@codemirror/lang-yaml';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { java } from '@codemirror/lang-java';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';
import { StreamLanguage } from '@codemirror/language';
import { properties } from '@codemirror/legacy-modes/mode/properties';
import { Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import type { ContentType } from '@/types';

const inputAttrs = EditorView.contentAttributes.of({
  spellcheck: 'false',
  autocorrect: 'off',
  autocapitalize: 'off',
});

const tabInput = Prec.highest(keymap.of([
  {
    key: 'Tab',
    run: (view) => {
      const { from, to } = view.state.selection.main;
      if (from !== to) {
        const startLine = view.state.doc.lineAt(from).number;
        const endOffset = view.state.doc.lineAt(to).from === to ? to - 1 : to;
        const endLine = view.state.doc.lineAt(Math.max(from, endOffset)).number;
        const changes = Array.from({ length: endLine - startLine + 1 }, (_, index) => {
          const line = view.state.doc.line(startLine + index);
          return { from: line.from, to: line.from, insert: '  ' };
        });
        view.dispatch({ changes });
        return true;
      }
      view.dispatch({
        changes: { from, to, insert: '  ' },
        selection: { anchor: from + 2 },
      });
      return true;
    },
  },
  {
    key: 'Shift-Tab',
    run: (view) => {
      const { from, to } = view.state.selection.main;
      if (from !== to) {
        const startLine = view.state.doc.lineAt(from).number;
        const endOffset = view.state.doc.lineAt(to).from === to ? to - 1 : to;
        const endLine = view.state.doc.lineAt(Math.max(from, endOffset)).number;
        const changes = Array.from({ length: endLine - startLine + 1 }, (_, index) => {
          const line = view.state.doc.line(startLine + index);
          const prefix = view.state.doc.sliceString(line.from, Math.min(line.from + 2, line.to));
          const removeLength = prefix.startsWith('  ') ? 2 : prefix.startsWith('\t') || prefix.startsWith(' ') ? 1 : 0;
          return removeLength ? { from: line.from, to: line.from + removeLength, insert: '' } : null;
        }).filter((change): change is { from: number; to: number; insert: string } => change !== null);
        if (changes.length > 0) view.dispatch({ changes });
        return true;
      }
      const preceding = view.state.doc.sliceString(Math.max(0, from - 2), from);
      if (preceding === '  ') {
        view.dispatch({ changes: { from: from - 2, to: from, insert: '' }, selection: { anchor: from - 2 } });
      } else if (from > 0 && view.state.doc.sliceString(from - 1, from) === '\t') {
        view.dispatch({ changes: { from: from - 1, to: from, insert: '' }, selection: { anchor: from - 1 } });
      }
      return true;
    },
  },
]));

export function getContentTypeExtensions(contentType: ContentType): Extension[] {
  switch (contentType) {
    case 'markdown': return [inputAttrs, tabInput, markdown()];
    case 'json': return [inputAttrs, tabInput, json()];
    case 'ini': return [inputAttrs, tabInput, StreamLanguage.define(properties)];
    case 'sql': return [inputAttrs, tabInput, sql()];
    case 'python': return [inputAttrs, tabInput, python()];
    case 'yaml': return [inputAttrs, tabInput, yaml()];
    case 'javascript': return [inputAttrs, tabInput, javascript()];
    case 'typescript': return [inputAttrs, tabInput, javascript({ typescript: true })];
    case 'xml': return [inputAttrs, tabInput, html()];
    case 'java': return [inputAttrs, tabInput, java()];
    case 'go': return [inputAttrs, tabInput, go()];
    case 'rust': return [inputAttrs, tabInput, rust()];
    case 'css': return [inputAttrs, tabInput, css()];
    case 'html': return [inputAttrs, tabInput, html()];
    default: return [inputAttrs, tabInput];
  }
}

export function getMarkdownNotebookExtensions(): Extension[] {
  return getContentTypeExtensions('markdown');
}
