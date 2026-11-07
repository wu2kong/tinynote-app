import { SourceEditorPanel } from '@/App';
import { useLicenseStore } from '@/store/useLicenseStore';
import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { loadNotebook } from '@/utils/fileSystem';
import { isSubPath } from '@/utils/path';
import { useI18n } from '@/i18n/useI18n';
import PropertyPanel from './PropertyPanel';
import Toast from './Toast';
import NotePanel from './NotePanel';
import MarkdownNotebookPanel from './MarkdownNotebookPanel';
import WriterNotebookPanel from './WriterNotebookPanel';
import CsvNotebookPanel from './CsvNotebookPanel';
import ChannelNotebookPanel from './ChannelNotebookPanel';
import TodoNotebookPanel from './TodoNotebookPanel';
import MindNotebookPanel from './MindNotebookPanel';
import UnsupportedNotebookPanel from './UnsupportedNotebookPanel';

/** A dedicated editor, with its own selection and the normal note save behavior. */
export default function NoteWindow() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const singleBlock = new URLSearchParams(window.location.search).has('noteId');
  const notebook = useStore((state) => state.currentNotebook);
  const block = useStore((state) => state.currentNoteBlock);
  const zoom = useStore((state) => state.zoomLevel);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        await useStore.getState().initApp();
        if (cancelled) return;
        useStore.setState({ currentNotebook: null, currentNoteBlock: null });
        const params = new URLSearchParams(window.location.search);
        const path = params.get('noteNotebook');
        const workspace = useStore.getState().storagePath;
        if (!path || !workspace || !isSubPath(workspace, path)) return;
        const notebook = await loadNotebook(path);
        if (cancelled || !notebook) return;
        const index = Number(params.get('noteIndex'));
        const candidate = notebook.noteBlocks[index];
        const target = candidate?.createdAt === params.get('noteCreatedAt')
          ? candidate
          : notebook.noteBlocks.find((item) => item.createdAt === params.get('noteCreatedAt'));
        // New blocks can still have a draft ID in the originating window.
        if (target && params.get('noteId')) target.id = params.get('noteId')!;
        useStore.setState({ currentNotebook: notebook, currentNoteBlock: target ?? null, showAppBar: false, showDirectoryPanel: false });
      } catch (error) {
        console.error('Failed to load independent note:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void start();
    void useLicenseStore.getState().hydrate();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="app-layout" style={{ width: `calc(100vw / ${zoom})`, height: `calc(100vh / ${zoom})` }}>
      {loading || !notebook || (singleBlock && !block)
        ? <div className="property-panel"><div className="property-panel-empty">
          {t(loading ? 'app.loading' : 'note.windowNoteMissing')}
        </div></div>
        : singleBlock ? <PropertyPanel />
        : notebook.format === 'markdown' ? <MarkdownNotebookPanel />
        : notebook.format === 'writer' ? <WriterNotebookPanel />
        : notebook.format === 'csv' ? <CsvNotebookPanel />
        : notebook.format === 'channel' ? <ChannelNotebookPanel key="channel" />
        : notebook.format === 'todo' ? <TodoNotebookPanel />
        : notebook.format === 'mind' ? <MindNotebookPanel />
        : notebook.format === 'link' ? <ChannelNotebookPanel key="link" linksOnly />
        : notebook.format === 'unsupported' ? <UnsupportedNotebookPanel />
        : notebook.isSourceMode ? <SourceEditorPanel />
        : <><NotePanel /><PropertyPanel /></>}
      <Toast />
    </div>
  );
}
