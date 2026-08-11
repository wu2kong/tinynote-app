import React, { useEffect, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { oneDark } from '@codemirror/theme-one-dark';
import { format as formatSql } from 'sql-formatter';
import { X, Braces, Eye, EyeOff } from 'lucide-react';
import { ContentType } from '@/types';
import { getContentTypeExtensions } from '@/utils/codemirrorExtensions';
import { showToast } from './Toast';
import { useI18n } from '@/i18n/useI18n';

interface ProfessionalEditorModalProps {
  open: boolean;
  title: string;
  content: string;
  contentType: ContentType;
  isDarkTheme: boolean;
  onChange: (content: string) => void;
  onClose: () => void;
}

const CONTENT_TYPE_LABEL_KEYS: Record<ContentType, string> = {
  text: 'property.contentTypes.text', json: 'property.contentTypes.json', xml: 'property.contentTypes.xml',
  ini: 'property.contentTypes.ini', bash: 'property.contentTypes.bash', shell: 'property.contentTypes.shell',
  sql: 'property.contentTypes.sql', javascript: 'property.contentTypes.javascript',
  typescript: 'property.contentTypes.typescript', python: 'property.contentTypes.python',
  java: 'property.contentTypes.java', go: 'property.contentTypes.go', rust: 'property.contentTypes.rust',
  yaml: 'property.contentTypes.yaml', markdown: 'property.contentTypes.markdown',
  css: 'property.contentTypes.css', html: 'property.contentTypes.html',
};

const ProfessionalEditorModal: React.FC<ProfessionalEditorModalProps> = ({
  open, title, content, contentType, isDarkTheme, onChange, onClose,
}) => {
  const { t } = useI18n();
  const [previewVisible, setPreviewVisible] = useState(true);
  const extensions = useMemo(() => getContentTypeExtensions(contentType), [contentType]);

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
      showToast(t('editor.jsonFormatted'));
    } catch {
      showToast(t('editor.jsonInvalid'));
    }
  };

  const formatSQL = () => {
    try {
      onChange(formatSql(content, { language: 'sql' }));
      showToast(t('editor.sqlFormatted'));
    } catch {
      showToast(t('editor.sqlInvalid'));
    }
  };

  return (
    <div className="modal-overlay professional-editor-overlay" onClick={onClose}>
      <section className="professional-editor-modal" onClick={(event) => event.stopPropagation()} aria-label={t('editor.ariaLabel')}>
        <header className="professional-editor-header">
          <div>
            <h3>{title || t('editor.untitledNote')}</h3>
            <span>{t('editor.subtitle', { type: t(CONTENT_TYPE_LABEL_KEYS[contentType]) })}</span>
          </div>
          <div className="professional-editor-actions">
            {contentType === 'json' && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={formatJson}>
                <Braces size={14} />{t('editor.formatJson')}
              </button>
            )}
            {contentType === 'sql' && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={formatSQL}>
                <Braces size={14} />{t('editor.formatSql')}
              </button>
            )}
            {contentType === 'markdown' && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPreviewVisible((visible) => !visible)}
              >
                {previewVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                {previewVisible ? t('editor.closePreview') : t('editor.openPreview')}
              </button>
            )}
            <button type="button" className="icon-btn" onClick={onClose} title={t('editor.closeEditor')} aria-label={t('editor.closeEditor')}>
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
            <aside className="professional-editor-preview" aria-label={t('editor.markdownPreview')}>
              <div className="professional-editor-preview-title">{t('editor.preview')}</div>
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
