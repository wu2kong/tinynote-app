import React, { useState } from 'react';
import { useStore } from '@/store/useStore';
import { serializeNoteBlocks, parseNoteBlocks } from '@/utils/noteParser';
import { Tag, Trash2, X, Code, Calendar } from 'lucide-react';

const PropertyPanel: React.FC = () => {
  const currentNotebook = useStore((s) => s.currentNotebook);
  const currentNoteBlock = useStore((s) => s.currentNoteBlock);
  const updateNoteBlock = useStore((s) => s.updateNoteBlock);
  const deleteNoteBlock = useStore((s) => s.deleteNoteBlock);
  const toggleSourceMode = useStore((s) => s.toggleSourceMode);
  const [tagInput, setTagInput] = useState('');
  const [sourceContent, setSourceContent] = useState('');

  if (!currentNotebook) {
    return (
      <div className="property-panel">
        <div className="property-panel-empty">选择笔记以编辑</div>
      </div>
    );
  }

  if (currentNotebook.isSourceMode) {
    const source = serializeNoteBlocks(currentNotebook.noteBlocks);
    if (!sourceContent && source) {
      setSourceContent(source);
    }

    return (
      <div className="property-panel">
        <div className="property-panel-header">
          <h3>源码模式</h3>
          <button className="icon-btn" onClick={() => { toggleSourceMode(); setSourceContent(''); }} title="退出源码模式">
            <Code size={16} />
          </button>
        </div>
        <textarea
          className="property-source-editor"
          value={sourceContent}
          onChange={(e) => setSourceContent(e.target.value)}
          spellCheck={false}
        />
        <button
          className="btn btn-primary"
          onClick={async () => {
            const blocks = parseNoteBlocks(sourceContent);
            useStore.setState((state) => ({
              currentNotebook: { ...state.currentNotebook!, noteBlocks: blocks, isSourceMode: false },
            }));
            setSourceContent('');
          }}
        >
          保存并解析
        </button>
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
        <button className="icon-btn" onClick={toggleSourceMode} title="源码模式">
          <Code size={16} />
        </button>
      </div>

      <div className="property-field">
        <label>标题</label>
        <input
          type="text"
          className="property-input"
          value={currentNoteBlock.title}
          onChange={(e) => updateNoteBlock(currentNoteBlock.id, { title: e.target.value })}
          placeholder="笔记标题"
        />
      </div>

      <div className="property-field property-field-content">
        <label>内容</label>
        <textarea
          className="property-textarea"
          value={currentNoteBlock.content}
          onChange={(e) => updateNoteBlock(currentNoteBlock.id, { content: e.target.value })}
          placeholder="笔记内容..."
          spellCheck={false}
        />
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