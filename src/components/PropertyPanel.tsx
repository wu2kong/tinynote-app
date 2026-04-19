import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { Tag, Trash2, X, Calendar, Maximize2, Minimize2, Code, Edit3, Eye, Copy, Check } from 'lucide-react';
import { ContentType } from '@/types';
import hljs from 'highlight.js';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: 'text', label: '纯文本' },
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
  { value: 'bash', label: 'Bash' },
  { value: 'shell', label: 'Shell' },
  { value: 'sql', label: 'SQL' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' },
];

const CONTENT_TYPE_MAP: Record<ContentType, string> = {
  text: 'plaintext',
  json: 'json',
  xml: 'xml',
  bash: 'bash',
  shell: 'shell',
  sql: 'sql',
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  java: 'java',
  go: 'go',
  rust: 'rust',
  yaml: 'yaml',
  markdown: 'markdown',
};

const PropertyPanel: React.FC = () => {
  const currentNotebook = useStore((s) => s.currentNotebook);
  const currentNoteBlock = useStore((s) => s.currentNoteBlock);
  const updateNoteBlock = useStore((s) => s.updateNoteBlock);
  const deleteNoteBlock = useStore((s) => s.deleteNoteBlock);
  const [tagInput, setTagInput] = useState('');
  const [contentExpanded, setContentExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(true);
  const [copied, setCopied] = useState(false);
  const contentExpandedRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

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
  }, [currentNoteBlock]);

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
      highlight.innerHTML = highlighted || '<span class="hljs-empty">空内容</span>';
    } catch {
      highlight.textContent = localContent || '空内容';
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

  const handleDelete = () => {
    deleteNoteBlock(currentNoteBlock.id);
  };

  return (
    <div className="property-panel">
      <div className="property-panel-header">
        <h3>编辑笔记</h3>
      </div>

      <div className="property-field">
        <label>标题</label>
        <input
          type="text"
          className="property-input"
          value={localTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
          onCompositionStart={() => { composingRef.current.title = true; }}
          onCompositionEnd={() => handleCompositionEnd('title')}
          placeholder="笔记标题"
        />
      </div>

      <div className="property-field property-field-content">
        <div className="property-field-header">
          <label>内容</label>
          <div className="property-field-actions">
            <button 
              className="content-action-btn" 
              onClick={handleCopyContent}
              title="复制内容"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <button 
              className="content-action-btn" 
              onClick={() => setIsEditing(!isEditing)}
              title={isEditing ? '预览' : '编辑'}
            >
              {isEditing ? <Eye size={14} /> : <Edit3 size={14} />}
            </button>
            <button 
              className="content-action-btn" 
              onClick={toggleContentExpanded}
              title={contentExpanded ? '收起' : '展开'}
            >
              {contentExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </div>
        {isEditing ? (
          <textarea
            ref={textareaRef}
            className={`property-textarea ${contentExpanded ? 'expanded' : 'collapsed'}`}
            value={localContent}
            onChange={(e) => handleContentChange(e.target.value)}
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
          <Code size={14} />
          内容类型
        </label>
        <select
          className="property-select"
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

      <div className="property-field">
        <label>
          <Tag size={14} />
          标签
        </label>
        <div className="property-tags">
          {currentNoteBlock.tags.map((tag) => (
            <span key={tag} className="property-tag">
              {tag}
              <button className="property-tag-remove" onClick={() => handleRemoveTag(tag)}>
                <X size={12} />
              </button>
            </span>
          ))}
          <div className="property-tag-input-wrapper">
            <input
              type="text"
              className="property-tag-input"
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

      <button className="btn btn-danger property-delete-btn" onClick={handleDelete}>
        <Trash2 size={14} />
        删除笔记
      </button>
    </div>
  );
};

export default PropertyPanel;