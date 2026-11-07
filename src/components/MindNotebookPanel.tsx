import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronsDown, ChevronsUp, Copy, CornerDownRight, ListTree, Network, PanelLeftClose, PanelLeftOpen, Plus, Trash2, ArrowUp, ArrowDown, MoveRight } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useI18n } from '@/i18n/useI18n';
import { registerDocumentSaveFlusher } from '@/utils/documentSaveFlush';
import { adjacentVisibleMindNode, createEmptyMindDocument, createMindNode, deleteMindNode, exportMindDocumentMarkdown, indentMindNode, insertMindNode, isMindBranchFullyExpanded, mapMindNodes, moveMindNode, moveMindNodeToParent, outdentMindNode, parseMindDocument, serializeMindDocument, setMindBranchCollapsed, wrapMindNodeWithParent, type MindDocument, type MindNode } from '@/utils/mindDocument';
import { showToast } from './Toast';
import { findMindTextLinkAtOffset, splitMindTextLinks } from '@/utils/mindTextLinks';
import { openExternalLink } from '@/utils/openExternalLink';

const MindNotebookPanel: React.FC = () => {
  const { t } = useI18n();
  const notebook = useStore((state) => state.currentNotebook);
  const showDirectoryPanel = useStore((state) => state.showDirectoryPanel);
  const showAppBar = useStore((state) => state.showAppBar);
  const toggleDirectoryPanel = useStore((state) => state.toggleDirectoryPanel);
  const updateNotebookContent = useStore((state) => state.updateNotebookContent);
  const [doc, setDoc] = useState<MindDocument>(createEmptyMindDocument);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modifierHeld, setModifierHeld] = useState(false);
  const pendingCaretRef = useRef<{ id: string; offset: number } | null>(null);
  const pendingFocusRef = useRef<string | null>(null);
  const docRef = useRef(doc);
  docRef.current = doc;
  const pathRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(updateNotebookContent);
  saveRef.current = updateNotebookContent;

  const flush = useCallback(() => {
    if (!timerRef.current) return Promise.resolve();
    clearTimeout(timerRef.current);
    timerRef.current = null;
    return pathRef.current ? saveRef.current(serializeMindDocument(docRef.current), pathRef.current) : Promise.resolve();
  }, []);
  useEffect(() => registerDocumentSaveFlusher(flush), [flush]);
  useEffect(() => () => { void flush(); }, [flush]);
  useEffect(() => {
    const update = (event: KeyboardEvent) => setModifierHeld(event.metaKey || event.ctrlKey);
    const reset = () => setModifierHeld(false);
    window.addEventListener('keydown', update);
    window.addEventListener('keyup', update);
    window.addEventListener('blur', reset);
    return () => { window.removeEventListener('keydown', update); window.removeEventListener('keyup', update); window.removeEventListener('blur', reset); };
  }, []);
  useLayoutEffect(() => {
    if (!editingId) return;
    const editor = document.querySelector<HTMLTextAreaElement>(`[data-mind-id="${editingId}"]`);
    if (!editor) return;
    editor.focus();
    pendingFocusRef.current = null;
    if (editor && pendingCaretRef.current?.id === editingId) {
      const offset = Math.min(pendingCaretRef.current.offset, editor.value.length);
      editor.setSelectionRange(offset, offset);
      pendingCaretRef.current = null;
    }
  }, [editingId, doc.mode]);
  useEffect(() => {
    if (!notebook || notebook.format !== 'mind') return;
    if (pathRef.current !== notebook.path) {
      void flush();
      pathRef.current = notebook.path;
      setDoc(parseMindDocument(notebook.content ?? ''));
      setMovingId(null);
      setEditingId(null);
      pendingFocusRef.current = null;
    } else if (!timerRef.current && notebook.content != null && notebook.content !== serializeMindDocument(docRef.current)) {
      setDoc(parseMindDocument(notebook.content));
    }
  }, [notebook?.path, notebook?.content, notebook?.format, flush]);

  const applyDoc = (next: MindDocument) => {
    docRef.current = next;
    setDoc(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { timerRef.current = null; if (pathRef.current) void saveRef.current(serializeMindDocument(next), pathRef.current); }, 400);
  };
  const focusNode = (id: string) => { pendingFocusRef.current = id; setEditingId(id); };
  const editAtClick = (id: string, text: string, event: React.MouseEvent<HTMLSpanElement>) => {
    const label = event.currentTarget;
    const position = (document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null }).caretPositionFromPoint?.(event.clientX, event.clientY);
    const fallback = document.caretRangeFromPoint?.(event.clientX, event.clientY);
    const target = position?.offsetNode ?? fallback?.startContainer;
    const targetOffset = position?.offset ?? fallback?.startOffset ?? 0;
    let offset = event.clientX <= label.getBoundingClientRect().left + 4 ? 0 : text.length;
    if (target && label.contains(target)) {
      const range = document.createRange();
      range.selectNodeContents(label);
      range.setEnd(target, targetOffset);
      offset = range.toString().length;
    }
    pendingCaretRef.current = { id, offset };
    focusNode(id);
  };
  const resizeNodeText = (element: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, docRef.current.mode === 'mindmap' ? 120 : 240)}px`;
  };
  const addNode = (targetId: string | null, placement: 'child' | 'after') => {
    const item = createMindNode();
    applyDoc({ ...docRef.current, nodes: insertMindNode(docRef.current.nodes, targetId, placement, item) });
    focusNode(item.id);
  };
  const patchNode = (id: string, patch: Partial<MindNode>) => applyDoc({ ...docRef.current, nodes: mapMindNodes(docRef.current.nodes, id, (node) => ({ ...node, ...patch })) });
  const destinations: { id: string; text: string; depth: number }[] = [];
  const collectDestinations = (nodes: MindNode[], depth: number) => {
    for (const node of nodes) {
      if (node.id === movingId) continue;
      destinations.push({ id: node.id, text: node.text, depth });
      collectDestinations(node.children, depth + 1);
    }
  };
  collectDestinations(doc.nodes, 0);
  const finishMove = (parentId: string | null) => {
    if (movingId) applyDoc({ ...docRef.current, nodes: moveMindNodeToParent(docRef.current.nodes, movingId, parentId) });
    setMovingId(null);
  };
  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(exportMindDocumentMarkdown(notebook?.name ?? '', docRef.current));
      showToast(t('mind.copiedMarkdown'));
    } catch {
      showToast(t('mind.copyFailed'));
    }
  };

  const renderNode = (node: MindNode, depth: number): React.ReactNode => {
    const children = !node.collapsed && node.children.length > 0;
    const body = <div className="mind-node" data-depth={depth}>
      <button type="button" className="mind-collapse" disabled={!node.children.length} aria-label={node.collapsed ? t('mind.expand') : t('mind.collapse')} onClick={() => patchNode(node.id, { collapsed: !node.collapsed })}>{node.children.length ? (node.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />) : <span className="mind-bullet" />}</button>
      {editingId === node.id ? <textarea data-mind-id={node.id} ref={resizeNodeText} autoFocus rows={1} wrap="soft" value={node.text} placeholder={depth === 0 ? t('mind.rootPlaceholder') : t('mind.nodePlaceholder')} onBlur={() => { if (pendingFocusRef.current) return; setEditingId((current) => current === node.id ? null : current); }} onChange={(event) => { resizeNodeText(event.currentTarget); patchNode(node.id, { text: event.target.value }); }} onClick={(event) => {
        if (!event.metaKey && !event.ctrlKey) return;
        const href = findMindTextLinkAtOffset(node.text, event.currentTarget.selectionStart);
        if (href) { event.preventDefault(); void openExternalLink(href); }
      }} onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (docRef.current.mode === 'outline' && (event.key === 'ArrowUp' || event.key === 'ArrowDown') && !event.altKey && !event.metaKey && !event.ctrlKey) {
          const target = adjacentVisibleMindNode(docRef.current.nodes, node.id, event.key === 'ArrowUp' ? -1 : 1);
          if (target) {
            event.preventDefault();
            pendingCaretRef.current = { id: target.id, offset: target.text.length };
            focusNode(target.id);
          }
          return;
        }
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); addNode(node.id, 'after'); }
        if (event.key === 'Tab') {
          event.preventDefault();
          if (docRef.current.mode === 'outline') {
            applyDoc({ ...docRef.current, nodes: event.shiftKey ? outdentMindNode(docRef.current.nodes, node.id) : indentMindNode(docRef.current.nodes, node.id) });
            focusNode(node.id);
          } else if (event.shiftKey) {
            const parent = createMindNode();
            applyDoc({ ...docRef.current, nodes: wrapMindNodeWithParent(docRef.current.nodes, node.id, parent) });
            focusNode(parent.id);
          } else addNode(node.id, 'child');
        }
        if (event.key === 'Backspace' && !node.text && !node.children.length) { event.preventDefault(); applyDoc({ ...docRef.current, nodes: deleteMindNode(docRef.current.nodes, node.id) }); }
      }} /> : <span className="mind-node-label" title={node.text || undefined} onMouseMove={(event) => setModifierHeld(event.metaKey || event.ctrlKey)} onClick={(event) => editAtClick(node.id, node.text, event)}>{node.text ? splitMindTextLinks(node.text).map((part, index) => part.href
        ? <span key={index} className={`mind-node-link${modifierHeld ? ' mind-node-link-active' : ''}`} onClick={(event) => { if (event.metaKey || event.ctrlKey) { event.stopPropagation(); void openExternalLink(part.href!); } }}>{part.text}</span>
        : <React.Fragment key={index}>{part.text}</React.Fragment>) : <span className="mind-node-placeholder">{depth === 0 ? t('mind.rootPlaceholder') : t('mind.nodePlaceholder')}</span>}</span>}
      <div className="mind-node-actions">
        {node.children.length > 0 && <button type="button" title={t(isMindBranchFullyExpanded(node) ? 'mind.collapseAll' : 'mind.expandAll')} aria-label={t(isMindBranchFullyExpanded(node) ? 'mind.collapseAll' : 'mind.expandAll')} onClick={() => applyDoc({ ...docRef.current, nodes: setMindBranchCollapsed(docRef.current.nodes, node.id, isMindBranchFullyExpanded(node)) })}>{isMindBranchFullyExpanded(node) ? <ChevronsUp size={14} /> : <ChevronsDown size={14} />}</button>}
        <button type="button" title={t('mind.addChild')} aria-label={t('mind.addChild')} onClick={() => addNode(node.id, 'child')}><CornerDownRight size={14} /></button>
        <button type="button" title={t('mind.addSibling')} aria-label={t('mind.addSibling')} onClick={() => addNode(node.id, 'after')}><Plus size={14} /></button>
        <button type="button" title={t('mind.moveUp')} aria-label={t('mind.moveUp')} onClick={() => applyDoc({ ...docRef.current, nodes: moveMindNode(docRef.current.nodes, node.id, -1) })}><ArrowUp size={14} /></button>
        <button type="button" title={t('mind.moveDown')} aria-label={t('mind.moveDown')} onClick={() => applyDoc({ ...docRef.current, nodes: moveMindNode(docRef.current.nodes, node.id, 1) })}><ArrowDown size={14} /></button>
        <button type="button" title={t('mind.moveTo')} aria-label={t('mind.moveTo')} onClick={() => setMovingId(node.id)}><MoveRight size={14} /></button>
        <button type="button" title={t('mind.delete')} aria-label={t('mind.delete')} onClick={() => applyDoc({ ...docRef.current, nodes: deleteMindNode(docRef.current.nodes, node.id) })}><Trash2 size={14} /></button>
      </div>
    </div>;
    return doc.mode === 'outline'
      ? <li key={node.id} className="mind-outline-item">{body}{children && <ul>{node.children.map((child) => renderNode(child, depth + 1))}</ul>}</li>
      : <div key={node.id} className="mind-map-branch">{body}{children && <div className="mind-map-children">{node.children.map((child) => renderNode(child, depth + 1))}</div>}</div>;
  };

  if (!notebook || notebook.format !== 'mind') return null;
  return <div className="channel-notebook-panel mind-notebook-panel">
    <header className="channel-notebook-header mind-notebook-header">
      <div className="channel-notebook-header-left"><button type="button" className="left-panel-toggle" onClick={toggleDirectoryPanel} title={showDirectoryPanel || showAppBar ? t('app.hideSidebar') : t('app.showSidebar')}>{showDirectoryPanel || showAppBar ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}</button><div className="channel-notebook-title-wrap"><h3>{notebook.name}</h3></div></div>
      <div className="mind-toolbar"><div className="checklist-view-switch" role="group" aria-label={t('mind.view')}><button type="button" className={doc.mode === 'outline' ? 'active' : ''} aria-pressed={doc.mode === 'outline'} onClick={() => applyDoc({ ...docRef.current, mode: 'outline' })}><ListTree size={15} />{t('mind.outline')}</button><button type="button" className={doc.mode === 'mindmap' ? 'active' : ''} aria-pressed={doc.mode === 'mindmap'} onClick={() => applyDoc({ ...docRef.current, mode: 'mindmap' })}><Network size={15} />{t('mind.mindmap')}</button></div><button type="button" className="btn btn-sm" onClick={() => addNode(null, 'after')}><Plus size={14} />{t('mind.addRoot')}</button><button type="button" className="btn btn-sm" onClick={() => void copyMarkdown()}><Copy size={14} />{t('mind.copyMarkdown')}</button></div>
    </header>
    <div className={`mind-content ${doc.mode === 'mindmap' ? 'mind-map' : 'mind-outline'}`}>
      {doc.nodes.length ? (doc.mode === 'outline' ? <ul>{doc.nodes.map((node) => renderNode(node, 0))}</ul> : <div className="mind-map-roots">{doc.nodes.map((node) => renderNode(node, 0))}</div>) : <div className="mind-empty"><p>{t('mind.empty')}</p><button type="button" className="btn btn-primary btn-sm" onClick={() => addNode(null, 'after')}><Plus size={14} />{t('mind.addRoot')}</button></div>}
    </div>
    {movingId && <div className="modal-overlay" onClick={() => setMovingId(null)}><div className="modal mind-move-modal" role="dialog" aria-modal="true" aria-label={t('mind.moveTo')} onClick={(event) => event.stopPropagation()}><h3 className="modal-title">{t('mind.moveTo')}</h3><div className="mind-move-options"><button type="button" onClick={() => finishMove(null)}>{t('mind.rootLevel')}</button>{destinations.map((option) => <button key={option.id} type="button" style={{ paddingLeft: `${12 + Math.min(option.depth, 8) * 16}px` }} onClick={() => finishMove(option.id)}>{option.text || t('mind.nodePlaceholder')}</button>)}</div><div className="channel-link-import-footer"><button type="button" className="btn btn-sm" onClick={() => setMovingId(null)}>{t('common.cancel')}</button></div></div></div>}
  </div>;
};

export default MindNotebookPanel;
