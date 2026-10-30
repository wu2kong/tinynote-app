import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { isTauri } from '@/platform/detect';
import { useStore } from '@/store/useStore';
import { showToast } from '@/components/Toast';
import { t } from '@/i18n';
import type { NoteBlock, Notebook } from '@/types';

export async function openNoteWindow(block: NoteBlock): Promise<void> {
  const { storagePath, currentNotebook } = useStore.getState();
  if (!storagePath || !currentNotebook || !isTauri()) return;
  await openNotebookWindow(currentNotebook, block);
}

export async function openNotebookWindow(notebook: Notebook, block?: NoteBlock): Promise<void> {
  const { storagePath } = useStore.getState();
  if (!storagePath || !isTauri()) return;
  const url = new URL(window.location.href);
  url.searchParams.set('workspace', storagePath);
  url.searchParams.set('noteNotebook', notebook.path);
  url.searchParams.delete('noteId');
  url.searchParams.delete('noteIndex');
  url.searchParams.delete('noteCreatedAt');
  if (block) {
    url.searchParams.set('noteId', block.id);
    url.searchParams.set('noteIndex', String(notebook.noteBlocks.findIndex((item) => item.id === block.id)));
    url.searchParams.set('noteCreatedAt', block.createdAt);
  }
  try {
    const webview = new WebviewWindow(`note-${crypto.randomUUID()}`, {
      url: url.toString(),
      title: `${block?.title || notebook.name || t('common.untitled')} — TinyNote`,
      width: 760,
      height: 720,
      minWidth: 400,
      minHeight: 400,
    });
    await webview.once('tauri://error', (event) => {
      console.error('Failed to open note window:', event.payload);
      showToast(t('note.openWindowFailed'));
    });
  } catch (error) {
    console.error('Failed to open note window:', error);
    showToast(t('note.openWindowFailed'));
  }
}
