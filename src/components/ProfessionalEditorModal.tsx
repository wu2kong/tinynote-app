import React, { useEffect, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
import { oneDark } from '@codemirror/theme-one-dark';
import { Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { format as formatSql } from 'sql-formatter';
import { X, Braces, Eye, EyeOff } from 'lucide-react';
import { ContentType } from '@/types';
import { showToast } from './Toast';

interface ProfessionalEditorModalProps {
  open: boolean;
  title: string;
  content: string;
  contentType: ContentType;
  isDarkTheme: boolean;
  onChange: (content: string) => void;
  onClose: () => void;
}

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  text: '纯文本', json: 'JSON', xml: 'XML', ini: 'INI', bash: 'Bash', shell: 'Shell', sql: 'SQL',
  javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python', java: 'Java',
  go: 'Go', rust: 'Rust', yaml: 'YAML', markdown: 'Markdown', css: 'CSS', html: 'HTML',
};

const ProfessionalEditorModal: React.FC<ProfessionalEditorModalProps> = ({
  open, title, content, contentType, isDarkTheme, onChange, onClose,
}) => {
  const [previewVisible, setPreviewVisible] = useState(true);
  const extensions = useMemo(() => {
    const inputAttrs = EditorView.contentAttributes.of({ spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' });
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
  }, [contentType]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const formatJson = () => {
    try {
      onChange(`${JSON.stringify(JSON.parse(content), null, 2)}\n`);
      showToast('JSON 已格式化');
    } catch {
      showToast('JSON 格式无效，无法格式化');
    }
  };

  const formatSQL = () => {
    try {
      onChange(formatSql(content, { language: 'sql' }));
      showToast('SQL 已格式化');
    } catch {
      showToast('SQL 格式无效，无法格式化');
    }
  };

  return (
    <div className="modal-overlay professional-editor-overlay" onClick={onClose}>
      <section className="professional-editor-modal" onClick={(event) => event.stopPropagation()} aria-label="专业编辑器">
        <header className="professional-editor-header">
          <div>
            <h3>{title || '未命名笔记'}</h3>
            <span>{CONTENT_TYPE_LABELS[contentType]} 专业编辑器 · 自动保存，关闭弹窗不会丢失内容</span>
          </div>
          <div className="professional-editor-actions">
            {contentType === 'json' && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={formatJson}>
                <Braces size={14} />格式化 JSON
              </button>
            )}
            {contentType === 'sql' && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={formatSQL}>
                <Braces size={14} />格式化 SQL
              </button>
            )}
            {contentType === 'markdown' && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPreviewVisible((visible) => !visible)}
              >
                {previewVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                {previewVisible ? '关闭预览' : '开启预览'}
              </button>
            )}
            <button type="button" className="icon-btn" onClick={onClose} title="关闭专业编辑器" aria-label="关闭专业编辑器">
              <X size={18} />
            </button>
          </div>
        </header>
        <div className={`professional-editor-body${contentType === 'markdown' && previewVisible ? ' markdown-split-view' : ''}`}>
          <div className="professional-editor-code">
            <CodeMirror
              value={content}
              height="100%"
              theme={isDarkTheme ? oneDark : undefined}
              extensions={extensions}
              onChange={onChange}
              basicSetup={{ lineNumbers: true, highlightActiveLine: true, bracketMatching: true, autocompletion: true }}
              autoFocus
            />
          </div>
          {contentType === 'markdown' && previewVisible && (
            <aside className="professional-editor-preview" aria-label="Markdown 预览">
              <div className="professional-editor-preview-title">预览</div>
              <article className="markdown-preview">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </article>
            </aside>
          )}
        </div>
      </section>
    </div>
  );
};

export default ProfessionalEditorModal;
