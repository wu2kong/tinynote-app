import { showToast } from '@/components/Toast';
import { t } from '@/i18n';
import { useStore } from '@/store/useStore';
import { importNotesToSpaceRoot, type ImportNoteSource } from '@/utils/importNotes';

export async function runImportNotesToCurrentSpace(sources: ImportNoteSource[]): Promise<boolean> {
  const space = useStore.getState().currentSpace;
  if (!space) {
    showToast(t('importNotes.noSpace'));
    return false;
  }
  if (sources.length === 0) {
    showToast(t('importNotes.noMarkdown'));
    return false;
  }

  try {
    const result = await importNotesToSpaceRoot(space.path, sources);
    await useStore.getState().reloadSpaces();
    if (result.imported === 0) {
      showToast(t('importNotes.noMarkdown'));
      return false;
    }
    showToast(t('importNotes.completed', {
      imported: result.imported,
      converted: result.converted,
    }));
    return true;
  } catch (error) {
    console.error('[tinynote] Failed to import notes:', error);
    showToast(t('importNotes.failed'));
    return false;
  }
}
