import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { Tag, X, Calendar, Maximize, Maximize2, Minimize2, Edit3, Eye, Copy, Check } from 'lucide-react';
import { ContentType } from '@/types';
import hljs from 'highlight.js';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import ProfessionalEditorModal from './ProfessionalEditorModal';

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: 'text', label: '纯文本' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'json', label: 'JSON' },
  { value: 'ini', label: 'INI' },
  { value: 'yaml', label: 'YAML' },
  { value: 'xml', label: 'XML' },
  { value: 'bash', label: 'Bash' },
  { value: 'shell', label: 'Shell' },
  { value: 'sql', label: 'SQL' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'java', label: 'Java' },
  { value: 'rust', label: 'Rust' },
  { value: 'css', label: 'CSS' },
  { value: 'html', label: 'HTML' }
];

const CONTENT_TYPE_MAP: Record<ContentType, string> = {
  text: 'plaintext',
  markdown: 'markdown',
  json: 'json',
  ini: 'ini',
  yaml: 'yaml',
  xml: 'xml',
  bash: 'bash',
  shell: 'shell',
  sql: 'sql',
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  go: 'go',
  java: 'java',
  rust: 'rust',
  css: 'css',
  html: 'html',
};

const PropertyPanel: React.FC = () => {
  const currentNotebook = useStore((s) => s.currentNotebook);
  const currentNoteBlock = useStore((s) => s.currentNoteBlock);
  const noteBlockFocusKey = useStore((s) => s.noteBlockFocusKey);
  const updateNoteBlock = useStore((s) => s.updateNoteBlock);
  const isDarkTheme = useStore((s) => s.isDarkTheme);
  const [tagInput, setTagInput] = useState('');
  const [contentExpanded, setContentExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(true);
  const [copied, setCopied] = useState(false);
  const [professionalEditorOpen, setProfessionalEditorOpen] = useState(false);
  const contentExpandedRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const [localTitle, setLocalTitle] = useState('');
  const [localContent, setLocalContent] = useState('');
  const composingRef = useRef({ title: false, content: false });
  const prevBlockIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentNoteBlock) return;
    if (prevBlockIdRef.current !== currentNoteBlock.id) {
      prevBlockIdRef.current = currentNoteBlock.id;
      if (!composingRef.current.title) setLocalTitle(currentNoteBlock.title);
      if (!composingRef.current.content) setLocalContent(currentNoteBlock.content);
    }
    const hasContent = currentNoteBlock.content.trim().length > 0;
    if (hasContent) setIsEditing(true);
    requestAnimationFrame(() => {
      if (hasContent) {
        const textarea = textareaRef.current;
        textarea?.focus();
        if (textarea) {
          textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
      } else {
        titleRef.current?.focus();
      }
    });
  }, [currentNoteBlock?.id, noteBlockFocusKey]);

  useEffect(() => {
    if (!currentNoteBlock) return;
    if (!composingRef.current.title) setLocalTitle(currentNoteBlock.title);
    if (!composingRef.current.content) setLocalContent(currentNoteBlock.content);
  }, [currentNoteBlock?.title, currentNoteBlock?.content]);

  const autoResizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || !contentExpandedRef.current) return;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }, []);

  const highlightCode = useCallback(() => {
    const highlight = highlightRef.current;
    if (!highlight || !currentNoteBlock) return;
    const contentType = currentNoteBlock.contentType || 'text';
    const language = CONTENT_TYPE_MAP[contentType];
    try {
      const highlighted = hljs.highlight(localContent, { language, ignoreIllegals: true }).value;
      highlight.innerHTML = highlighted || '<span class="hljs-empty">空内容...</span>';
    } catch {
      highlight.textContent = localContent || '空内容...';
    }
  }, [localContent, currentNoteBlock]);

  const handleFocusContent = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleBlurContent = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleCopyContent = useCallback(async () => {
    try {
      await writeText(localContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        await navigator.clipboard.writeText(localContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  }, [localContent]);

  const toggleContentExpanded = useCallback(() => {
    contentExpandedRef.current = !contentExpandedRef.current;
    setContentExpanded(contentExpandedRef.current);
  }, []);

  useEffect(() => {
    if (isEditing) {
      autoResizeTextarea();
    }
  }, [localContent, contentExpanded, isEditing, autoResizeTextarea]);

  useEffect(() => {
    if (contentExpanded) {
      autoResizeTextarea();
    }
  }, [contentExpanded, autoResizeTextarea]);

  useEffect(() => {
    if (!isEditing) {
      highlightCode();
    }
  }, [isEditing, highlightCode]);

  const handleTitleChange = useCallback((value: string) => {
    setLocalTitle(value);
    if (!composingRef.current.title) {
      updateNoteBlock(currentNoteBlock!.id, { title: value });
    }
  }, [updateNoteBlock, currentNoteBlock]);

  const handleContentChange = useCallback((value: string) => {
    setLocalContent(value);
    if (!composingRef.current.content) {
      updateNoteBlock(currentNoteBlock!.id, { content: value });
    }
  }, [updateNoteBlock, currentNoteBlock]);

  const handleCompositionEnd = useCallback((field: 'title' | 'content') => {
    composingRef.current[field] = false;
    const blockId = currentNoteBlock?.id;
    if (!blockId) return;
    if (field === 'title') {
      updateNoteBlock(blockId, { title: localTitle });
    } else {
      updateNoteBlock(blockId, { content: localContent });
    }
  }, [updateNoteBlock, currentNoteBlock, localTitle, localContent]);

  if (!currentNotebook) {
    return (
      <div className="property-panel">
        <div className="property-panel-empty">选择笔记以编辑</div>
      </div>
    );
  }

  if (!currentNoteBlock) {
    return (
      <div className="property-panel">
        <div className="property-panel-empty">选择笔记以编辑</div>
      </div>
    );
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !currentNoteBlock.tags.includes(tagInput.trim())) {
      updateNoteBlock(currentNoteBlock.id, {
        tags: [...currentNoteBlock.tags, tagInput.trim()],
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    updateNoteBlock(currentNoteBlock.id, {
      tags: currentNoteBlock.tags.filter((t) => t !== tag),
    });
  };

  return (
    <div className="property-panel">
      <div className="property-panel-header" style={{ display: 'none' }}>
        <h3>编辑笔记</h3>
      </div>

      <div className="property-field">
        <label>标题</label>
        <input
          ref={titleRef}
          type="text"
          className="property-input"
          tabIndex={0}
          value={localTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault();
              if (isEditing) {
                textareaRef.current?.focus();
              } else {
                setIsEditing(true);
                requestAnimationFrame(() => {
                  textareaRef.current?.focus();
                });
              }
            }
          }}
          onCompositionStart={() => { composingRef.current.title = true; }}
          onCompositionEnd={() => handleCompositionEnd('title')}
          placeholder="笔记标题"
        />
      </div>

      <div className="property-field property-field-content">
        <div className="property-field-header">
          <div className="property-field-label-group">
            <label>正文</label>
            <select
              className="property-select-inline"
              tabIndex={-1}
              value={currentNoteBlock.contentType || 'text'}
              onChange={(e) => updateNoteBlock(currentNoteBlock.id, { contentType: e.target.value as ContentType })}
            >
              {CONTENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div className="property-field-actions">
            <button
              className="content-action-btn"
              tabIndex={-1}
              onClick={handleCopyContent}
              title="复制内容"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <button
              className="content-action-btn"
              tabIndex={-1}
              onClick={() => setIsEditing(!isEditing)}
              title={isEditing ? '预览' : '编辑'}
            >
              {isEditing ? <Eye size={14} /> : <Edit3 size={14} />}
            </button>
            <button
              className="content-action-btn"
              tabIndex={-1}
              onClick={toggleContentExpanded}
              title={contentExpanded ? '收起' : '展开'}
            >
              {contentExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              className="content-action-btn professional-editor-btn"
              tabIndex={-1}
              onClick={() => setProfessionalEditorOpen(true)}
              title="全屏专业编辑"
              aria-label="全屏专业编辑"
            >
              <Maximize size={14} />
            </button>
          </div>
        </div>
        {isEditing ? (
          <textarea
            ref={textareaRef}
            className={`property-textarea ${contentExpanded ? 'expanded' : 'collapsed'}`}
            tabIndex={0}
            value={localContent}
            onChange={(e) => handleContentChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Tab') return;
              e.preventDefault();
              const textarea = e.currentTarget;
              const { selectionStart: start, selectionEnd: end } = textarea;
              let nextContent: string;
              let nextStart: number;
              let nextEnd: number;

              if (start === end) {
                if (e.shiftKey) {
                  const preceding = localContent.slice(Math.max(0, start - 2), start);
                  const removeLength = preceding === '  ' ? 2 : localContent[start - 1] === '\t' ? 1 : 0;
                  nextContent = `${localContent.slice(0, start - removeLength)}${localContent.slice(end)}`;
                  nextStart = nextEnd = start - removeLength;
                } else {
                  nextContent = `${localContent.slice(0, start)}  ${localContent.slice(end)}`;
                  nextStart = nextEnd = start + 2;
                }
              } else {
                const firstLineStart = localContent.lastIndexOf('\n', start - 1) + 1;
                const selectedEnd = localContent[end - 1] === '\n' ? end - 1 : end;
                const selectedLines = localContent.slice(firstLineStart, selectedEnd).split('\n');
                const removals: number[] = [];
                const updatedLines = selectedLines.map((line) => {
                  if (!e.shiftKey) return `  ${line}`;
                  const removeLength = line.startsWith('  ') ? 2 : line.startsWith('\t') || line.startsWith(' ') ? 1 : 0;
                  removals.push(removeLength);
                  return line.slice(removeLength);
                });
                const offset = e.shiftKey ? -removals.reduce((sum, length) => sum + length, 0) : selectedLines.length * 2;
                const firstLineOffset = e.shiftKey ? -(removals[0] || 0) : 2;
                nextContent = `${localContent.slice(0, firstLineStart)}${updatedLines.join('\n')}${localContent.slice(selectedEnd)}`;
                nextStart = start + firstLineOffset;
                nextEnd = end + offset;
              }
              handleContentChange(nextContent);
              requestAnimationFrame(() => {
                textarea.setSelectionRange(nextStart, nextEnd);
              });
            }}
            onInput={autoResizeTextarea}
            onFocus={handleFocusContent}
            onBlur={handleBlurContent}
            onCompositionStart={() => { composingRef.current.content = true; }}
            onCompositionEnd={() => handleCompositionEnd('content')}
            placeholder="笔记内容..."
            spellCheck={false}
          />
        ) : (
          <pre 
            ref={highlightRef} 
            className={`property-highlight-box ${contentExpanded ? 'expanded' : 'collapsed'}`}
            onClick={() => setIsEditing(true)}
          >
            {localContent || '点击编辑...'}
          </pre>
        )}
      </div>

      <div className="property-field">
        <label>
          <Tag size={14} />
          标签
        </label>
        <div className="property-tags">
          {currentNoteBlock.tags.map((tag) => (
            <span key={tag} className="property-tag">
              {tag}
              <button className="property-tag-remove" tabIndex={-1} onClick={() => handleRemoveTag(tag)}>
                <X size={12} />
              </button>
            </span>
          ))}
          <div className="property-tag-input-wrapper">
            <input
              type="text"
              className="property-tag-input"
              tabIndex={-1}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); }}
              placeholder="添加标签..."
            />
          </div>
        </div>
      </div>

      <div className="property-field property-field-meta">
        <label>
          <Calendar size={14} />
          创建时间
        </label>
        <span className="property-meta-text">
          {new Date(currentNoteBlock.createdAt).toLocaleString()}
        </span>
        <label>
          <Calendar size={14} />
          更新时间
        </label>
        <span className="property-meta-text">
          {new Date(currentNoteBlock.updatedAt).toLocaleString()}
        </span>
      </div>

      <ProfessionalEditorModal
        open={professionalEditorOpen}
        title={currentNoteBlock.title}
        content={localContent}
        contentType={currentNoteBlock.contentType || 'text'}
        isDarkTheme={isDarkTheme}
        onChange={handleContentChange}
        onClose={() => setProfessionalEditorOpen(false)}
      />
    </div>
  );
};

export default PropertyPanel;
