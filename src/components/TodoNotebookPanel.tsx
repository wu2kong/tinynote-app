import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useI18n } from '@/i18n/useI18n';
import { registerDocumentSaveFlusher } from '@/utils/documentSaveFlush';
import { createEmptyTodoDocument, parseTodoDocument, serializeTodoDocument, type TodoDocument } from '@/utils/todoDocument';
import ChannelTodosPanel from './ChannelTodosPanel';

const TodoNotebookPanel: React.FC = () => {
  const { t } = useI18n();
  const notebook = useStore((state) => state.currentNotebook);
  const showDirectoryPanel = useStore((state) => state.showDirectoryPanel);
  const showAppBar = useStore((state) => state.showAppBar);
  const toggleDirectoryPanel = useStore((state) => state.toggleDirectoryPanel);
  const updateNotebookContent = useStore((state) => state.updateNotebookContent);
  const [doc, setDoc] = useState<TodoDocument>(createEmptyTodoDocument);
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
    return pathRef.current ? saveRef.current(serializeTodoDocument(docRef.current), pathRef.current) : Promise.resolve();
  }, []);

  useEffect(() => registerDocumentSaveFlusher(flush), [flush]);
  useEffect(() => () => { void flush(); }, [flush]);
  useEffect(() => {
    if (!notebook || notebook.format !== 'todo') return;
    if (pathRef.current !== notebook.path) {
      void flush();
      pathRef.current = notebook.path;
      setDoc(parseTodoDocument(notebook.content ?? ''));
    } else if (!timerRef.current && notebook.content != null && notebook.content !== serializeTodoDocument(docRef.current)) {
      setDoc(parseTodoDocument(notebook.content));
    }
  }, [notebook?.path, notebook?.content, notebook?.format, flush]);

  const applyDoc = (next: TodoDocument) => {
    docRef.current = next;
    setDoc(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { timerRef.current = null; if (pathRef.current) void saveRef.current(serializeTodoDocument(next), pathRef.current); }, 400);
  };

  if (!notebook || notebook.format !== 'todo') return null;
  return <div className="channel-notebook-panel todo-notebook-panel">
    <header className="channel-notebook-header channel-notebook-header-left">
      <button type="button" className="left-panel-toggle" onClick={toggleDirectoryPanel} title={showDirectoryPanel || showAppBar ? t('app.hideSidebar') : t('app.showSidebar')}>
        {showDirectoryPanel || showAppBar ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
      </button>
      <div className="channel-notebook-title-wrap"><h3>{notebook.name}</h3></div>
    </header>
    <ChannelTodosPanel todos={doc.todos} groups={doc.todoGroups} view={doc.todoView} onViewChange={(todoView) => applyDoc({ ...docRef.current, todoView })} onChange={(todos, todoGroups) => applyDoc({ ...docRef.current, todos, todoGroups })} />
  </div>;
};

export default TodoNotebookPanel;
