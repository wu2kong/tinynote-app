import { emit, listen } from '@tauri-apps/api/event';
import { isTauri } from '@/platform/detect';
import type { Notebook } from '@/types';

const EVENT = 'tinynote-notebook-saved';
const source = crypto.randomUUID();

export async function notifyNotebookSaved(notebook: Notebook): Promise<void> {
  if (!isTauri()) return;
  // Notification failures must not turn a successful disk write into a failed save.
  await emit(EVENT, { source, notebook }).catch(console.warn);
}

export async function listenForNotebookSaves(onSave: (notebook: Notebook) => void): Promise<() => void> {
  if (!isTauri()) return () => {};
  return listen<{ source: string; notebook: Notebook }>(EVENT, ({ payload }) => {
    if (payload.source !== source) onSave(payload.notebook);
  });
}
