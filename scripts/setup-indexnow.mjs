import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const key = process.env.INDEXNOW_KEY;
if (!key || !/^[A-Za-z0-9-]{8,128}$/.test(key)) {
  throw new Error('Set INDEXNOW_KEY to the key generated at https://www.bing.com/indexnow.');
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(rootDir, 'landing', `${key}.txt`);
await writeFile(destination, key, 'utf8');
process.stdout.write(`Wrote ${path.relative(rootDir, destination)}. Deploy it at the site root before submitting URLs.\n`);
