import { getStorageAdapter } from '@/adapters/storage';
import * as config from '@/utils/config';
import { joinPath, normalizePath } from '@/utils/path';
import type { AppLocale } from '@/types';
import { getOfficialSampleLibraryDefinition } from '@/utils/officialSampleLibraryContent';

export type { OfficialSampleFile } from '@/utils/officialSampleLibraryContent';
export { getOfficialSampleLibraryDefinition } from '@/utils/officialSampleLibraryContent';

export interface OfficialSampleLibraryImportResult {
  spaceName: string;
  spacePath: string;
  welcomeNotebookPath: string;
  noteCount: number;
}

async function findAvailableSpace(storagePath: string, baseName: string): Promise<{ name: string; path: string }> {
  const adapter = getStorageAdapter();
  for (let index = 1; index < 10_000; index += 1) {
    const name = index === 1 ? baseName : `${baseName} ${index}`;
    const path = joinPath(storagePath, `${name}.tinynotes`);
    if (!(await adapter.exists(path))) return { name, path };
  }
  throw new Error('Unable to find an available name for the sample library');
}

export async function importOfficialSampleLibrary(
  storagePath: string,
  locale: AppLocale = 'en',
): Promise<OfficialSampleLibraryImportResult> {
  const root = normalizePath(storagePath);
  const adapter = getStorageAdapter();
  const sample = getOfficialSampleLibraryDefinition(locale);
  const target = await findAvailableSpace(root, sample.spaceName);

  await adapter.mkdir(target.path, true);
  try {
    const groups = new Set(sample.files.map((file) => file.relativePath.split('/')[0]));
    for (const group of groups) {
      await adapter.mkdir(joinPath(target.path, group), true);
    }
    for (const file of sample.files) {
      await adapter.writeTextFile(joinPath(target.path, file.relativePath), file.content);
    }

    const current = config.getConfig();
    await config.saveConfig({
      spaceOrder: [...current.spaceOrder.filter((path) => normalizePath(path) !== target.path), target.path],
      spaceIcons: { ...current.spaceIcons, [target.path]: '🧭' },
    });
  } catch (error) {
    await adapter.remove(target.path, true).catch(() => undefined);
    throw error;
  }

  return {
    spaceName: target.name,
    spacePath: target.path,
    welcomeNotebookPath: joinPath(target.path, sample.files[0].relativePath),
    noteCount: sample.files.length,
  };
}
