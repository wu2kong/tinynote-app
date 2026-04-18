import { NoteBlock } from '@/types';

export function parseNoteBlocks(content: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  const lines = content.split('\n');
  let pos = 0;

  while (pos < lines.length) {
    while (pos < lines.length && lines[pos].trim() === '') {
      pos++;
    }
    if (pos >= lines.length) break;

    if (lines[pos].trim() !== '---') {
      pos++;
      continue;
    }
    pos++;

    const fmLines: string[] = [];
    while (pos < lines.length && lines[pos].trim() !== '---') {
      fmLines.push(lines[pos]);
      pos++;
    }
    if (pos >= lines.length) break;
    pos++;

    const frontmatter = fmLines.join('\n');
    const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);
    const tagsMatch = frontmatter.match(/^tags:\s*\[(.+)\]$/m);
    const createdAtMatch = frontmatter.match(/^createdAt:\s*(.+)$/m);
    const updatedAtMatch = frontmatter.match(/^updatedAt:\s*(.+)$/m);

    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
    const tags = tagsMatch
      ? tagsMatch[1].split(',').map((t) => t.trim()).filter(Boolean)
      : [];
    const createdAt = createdAtMatch ? createdAtMatch[1].trim() : new Date().toISOString();
    const updatedAt = updatedAtMatch ? updatedAtMatch[1].trim() : createdAt;

    const bodyLines: string[] = [];
    while (pos < lines.length) {
      if (lines[pos].trim() === '---' && isBlockStart(lines, pos)) {
        break;
      }
      bodyLines.push(lines[pos]);
      pos++;
    }

    let bodyContent = bodyLines.join('\n');
    bodyContent = bodyContent.replace(/\n+$/, '');

    blocks.push({
      id: crypto.randomUUID(),
      title,
      content: bodyContent,
      tags,
      createdAt,
      updatedAt,
    });
  }

  return blocks;
}

function isBlockStart(lines: string[], pos: number): boolean {
  if (lines[pos].trim() !== '---') return false;

  let i = pos + 1;
  let foundClosing = false;
  let hasYamlKey = false;
  let lineCount = 0;

  while (i < lines.length && lineCount < 50) {
    lineCount++;
    const line = lines[i].trim();
    if (line === '---') {
      foundClosing = true;
      break;
    }
    if (
      line.startsWith('title:') ||
      line.startsWith('tags:') ||
      line.startsWith('createdAt:') ||
      line.startsWith('updatedAt:')
    ) {
      hasYamlKey = true;
    }
    i++;
  }

  return hasYamlKey && foundClosing;
}

export function serializeNoteBlocks(blocks: NoteBlock[]): string {
  return blocks
    .map((block) => {
      const tags = block.tags.length > 0 ? `[${block.tags.join(', ')}]` : '[]';
      return `---\ntitle: ${block.title}\ntags: ${tags}\ncreatedAt: ${block.createdAt}\nupdatedAt: ${block.updatedAt}\n---\n\n${block.content}`;
    })
    .join('\n\n');
}

export function createNoteBlock(partial?: Partial<NoteBlock>): NoteBlock {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: partial?.title ?? 'Untitled',
    content: partial?.content ?? '',
    tags: partial?.tags ?? [],
    createdAt: partial?.createdAt ?? now,
    updatedAt: partial?.updatedAt ?? now,
  };
}