import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOfficialSampleLibraryDefinition } from '../src/utils/officialSampleLibraryContent.ts';

const locales = ['en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'de', 'fr', 'it', 'ru'] as const;
const out = {} as Record<string, { spaceName: string; files: { relativePath: string; content: string }[] }>;

for (const locale of locales) {
  const def = getOfficialSampleLibraryDefinition(locale);
  out[locale] = {
    spaceName: def.spaceName,
    files: def.files.map((file) => ({ relativePath: file.relativePath, content: file.content })),
  };
}

const dest = resolve(dirname(fileURLToPath(import.meta.url)), '../mobile/assets/sample_library.json');
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(out));
console.log(`wrote ${dest} (${JSON.stringify(out).length} bytes)`);
