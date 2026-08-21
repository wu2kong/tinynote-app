import { getStorageAdapter } from '@/adapters/storage';
import * as config from '@/utils/config';
import { joinPath, normalizePath } from '@/utils/path';
import type { AppLocale, ContentType } from '@/types';
import { LOCALIZED_STARTER_COPIES, type LocalizedStarterCopy } from '@/utils/officialSampleLibraryLocales';

const SPACE_NAME = 'TinyNote Starter Kit';
const CREATED_AT = '2026-01-01T09:00:00.000Z';

export interface OfficialSampleFile {
  relativePath: string;
  content: string;
}

export interface OfficialSampleLibraryImportResult {
  spaceName: string;
  spacePath: string;
  welcomeNotebookPath: string;
  noteCount: number;
}

function block(title: string, content: string, contentType: ContentType = 'text', tags: string[] = []): string {
  return `---\ntitle: ${title}\ncontentType: ${contentType}\ntags: [${tags.join(', ')}]\ncreatedAt: ${CREATED_AT}\nupdatedAt: ${CREATED_AT}\n---\n${content.trim()}`;
}

const welcomeBlocks = [
  block(
    '👋 Welcome — start here',
    `This is your TinyNote Starter Kit. It is a normal, editable space stored alongside your own notes.

TinyNote has three complementary note formats:
• Block notes keep reusable ideas and snippets in small, movable cards.
• Markdown notes pair source editing with a live preview.
• Article notes provide a focused, page-like writing experience.

Try clicking the blocks in this note, then explore the folders on the left. You can edit or delete every sample.`,
    'text',
    ['start-here', 'tinynote'],
  ),
  block(
    '1. Capture reusable knowledge as blocks',
    `A block is an independent piece of knowledge with its own title, type, tags, and timestamps.

Try this now:
1. Select this block.
2. Edit its title or content in the inspector.
3. Drag it to a new position.
4. Use the copy button to put its content on the clipboard.
5. Right-click it to duplicate, insert, copy, paste, or delete.`,
    'text',
    ['blocks', 'tutorial'],
  ),
  block(
    '2. Use content types for snippets',
    `const tinyNote = {
  localFirst: true,
  formats: ['blocks', 'markdown', 'writer'],
  superpower: 'knowledge you can reuse'
};

console.log(tinyNote.superpower);`,
    'javascript',
    ['code', 'highlighting'],
  ),
  block(
    '3. Find anything quickly',
    `Use the search box above the note list to filter the current space.

Keyboard shortcuts:
• Cmd/Ctrl + F — focus search in the current space
• Cmd/Ctrl + Shift + F — search across every space
• Cmd/Ctrl + P — open recent notes
• Cmd/Ctrl + I — open AI chat

Search matches titles, content, tags, and supported document text.`,
    'text',
    ['search', 'shortcuts'],
  ),
  block(
    '4. Organize without lock-in',
    `Spaces are folders ending in .tinynotes. Groups are ordinary subfolders. Notes are Markdown files.

That means your library remains readable with a text editor, searchable with system tools, friendly to Git, and easy to back up. Open Settings → Data to see the exact paths.`,
    'markdown',
    ['local-first', 'organization'],
  ),
  block(
    '5. Make TinyNote yours',
    `Open Settings to choose a theme, language, layout, interface zoom, backups, Git sync, and AI providers.

Good next steps:
• Create a space for an active project.
• Add a block note for commands and reusable facts.
• Add a Markdown note for technical documentation.
• Add an article note for long-form thinking.

Tip: you can import another fresh Starter Kit from Settings → Data at any time.`,
    'text',
    ['settings', 'next-steps'],
  ),
].join('\n\n');

const projectBlocks = [
  block(
    'Project brief',
    `Goal: launch a small documentation site that helps new users reach their first useful result in under five minutes.

Success signals:
• A first note is created during the initial session.
• Search is used successfully.
• The user understands where files are stored.

Constraints: one-week prototype, two contributors, local-first data.`,
    'text',
    ['project', 'brief'],
  ),
  block(
    'Launch checklist',
    `- [x] Define the user outcome
- [x] Sketch the information architecture
- [ ] Build the smallest useful flow
- [ ] Test with three first-time users
- [ ] Document decisions and open questions
- [ ] Schedule a retrospective`,
    'markdown',
    ['project', 'checklist'],
  ),
  block(
    'API response fixture',
    `{
  "project": "Starter Kit",
  "status": "in_progress",
  "owners": ["Ada", "Grace"],
  "milestones": 3,
  "offlineReady": true
}`,
    'json',
    ['project', 'fixture'],
  ),
  block(
    'Useful query',
    `SELECT owner, COUNT(*) AS open_tasks
FROM tasks
WHERE completed_at IS NULL
GROUP BY owner
ORDER BY open_tasks DESC;`,
    'sql',
    ['project', 'sql'],
  ),
  block(
    'Local preview command',
    `npm install
npm run dev`,
    'bash',
    ['project', 'command'],
  ),
  block(
    'Reference links',
    `TinyNote documentation: https://tinynote.wu2kong.com/
CommonMark specification: https://spec.commonmark.org/
Git documentation: https://git-scm.com/doc`,
    'text',
    ['links', 'reference'],
  ),
].join('\n\n');

const cookbookBlocks = [
  block('Docker: follow logs', 'docker compose logs --follow --tail=100', 'bash', ['docker', 'command']),
  block('Git: compact history', 'git log --oneline --graph --decorate --all', 'bash', ['git', 'command']),
  block('CSS: centered content', `.centered {
  display: grid;
  min-height: 100dvh;
  place-items: center;
}`, 'css', ['css', 'snippet']),
  block('Python: group by key', `from collections import defaultdict

grouped = defaultdict(list)
for item in items:
    grouped[item["category"]].append(item)`, 'python', ['python', 'snippet']),
  block('YAML: small CI job', `name: checks
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test`, 'yaml', ['yaml', 'ci']),
].join('\n\n');

const markdownGuide = `# Markdown Field Guide

This editable note demonstrates the Markdown features you will use most often. Switch between **Edit**, **Preview**, and **Split** in the top-right corner.

> Markdown keeps structure in plain text, so the note stays portable and readable outside TinyNote.

## Text and links

Use **bold** for emphasis, *italics* for a lighter accent, and ~~strikethrough~~ for superseded ideas. Add [descriptive links](https://commonmark.org/) instead of pasting unexplained URLs.

## Lists and tasks

- One idea per bullet
  - Indent to express hierarchy
- Keep parallel wording

1. Capture
2. Clarify
3. Connect
4. Review

- [x] Pick a storage folder
- [x] Explore the Starter Kit
- [ ] Create your first personal space
- [ ] Pin down a weekly review habit

## A useful table

| Note format | Best for | Editing style |
|:--|:--|:--|
| Blocks | Snippets, facts, commands | Cards plus inspector |
| Markdown | Docs, research, technical notes | Source and preview |
| Article | Essays, journals, long-form drafts | Focused rich editor |

## A simple chart

Markdown tables can also communicate small datasets without a separate charting tool.

| Activity | Minutes | Visual |
|:--|--:|:--|
| Capture | 10 | ████ |
| Organize | 5 | ██ |
| Create | 20 | ████████ |
| Review | 15 | ██████ |

## Code

Inline code such as \`npm run dev\` is useful for names and short commands.

~~~typescript
type NoteFormat = 'blocks' | 'markdown' | 'writer';

const chooseFormat = (goal: string): NoteFormat =>
  goal === 'reuse' ? 'blocks' : goal === 'publish' ? 'markdown' : 'writer';
~~~

## Diagram source

Many Markdown ecosystems recognize Mermaid fences. TinyNote preserves this source as portable Markdown even when a theme displays it as a code block.

~~~mermaid
flowchart LR
  Capture --> Clarify --> Connect --> Create
  Create --> Review --> Capture
~~~

## Images

Use descriptive alternative text:

~~~markdown
![A short description of the image](https://example.com/image.png)
~~~

## Footnotes and references

GitHub Flavored Markdown adds tables, task lists, and strikethrough to the portable CommonMark core. For exact syntax details, see the [CommonMark specification](https://spec.commonmark.org/) and [GitHub's writing guide](https://docs.github.com/en/get-started/writing-on-github).

---

### A small practice

Duplicate this note, delete the sections you do not need, and turn it into a template for project documentation.
`;

const weeklyReview = `# A Quiet Weekly Review

The most useful note system is not the one that captures everything. It is the one that reliably brings the right thing back into view.

## Clear the surface

Start by collecting loose fragments: an idea from a conversation, a command that finally worked, a decision waiting for context. Move durable fragments into block notes. Their small size makes them easy to tag, rearrange, search, and copy later.

## Look for movement

Review active projects with three questions:

1. What changed since the last review?
2. What is the next visible action?
3. What can be deleted, delegated, or deferred?

Do not turn the review into another project. A short, honest pass is better than a perfect ritual that never happens.

## Make one connection

Find two notes that belong together. Add a shared tag, place them in the same group, or combine them into a clearer document. Knowledge becomes useful when it gains context.

## Leave a trail for your future self

End with a brief note: what matters next week, what remains uncertain, and what “good enough” will look like. This is where an article note shines—the page encourages complete thoughts without hiding the underlying Markdown file.

> “Well begun is half done.” — a proverb commonly associated with Aristotle

## Review template

- Wins:
- Open loops:
- Decisions made:
- Next three actions:
- One thing to stop doing:
`;

const spacesFeature = `# Spaces: Give Every Part of Life Its Own Home

One of TinyNote's most important ideas is simple: **you can create multiple spaces, and each space can represent an independent area of your life or work**.

A single giant notebook eventually mixes unrelated contexts. A command needed at work appears beside a grocery list; study notes compete with vacation plans; a book draft gets buried under daily fragments. Spaces keep those worlds close at hand without blending them together.

## Start with broad areas

A practical first setup might include:

| Space | What belongs there |
|:--|:--|
| Life | Household notes, plans, routines, useful records |
| Work | Projects, meetings, procedures, reusable answers |
| Learning | Courses, reading notes, concepts, exercises |
| Interests | Photography, cooking, games, travel, collecting |

These boundaries reduce mental switching. When you enter the Work space, the sidebar and local search show work knowledge. When you enter Learning, the same interface becomes a study environment.

## Create focused spaces when a topic grows

A space can also be much more specific:

- **Book Writing** — research, character notes, chapter drafts, revision checklists.
- **Photography** — location ideas, camera settings, editing recipes, inspiring links.
- **Home Lab** — server commands, network diagrams, maintenance logs.
- **Navigation Hub** — categorized bookmarks, frequently visited tools, link collections.
- **Password Operations** — non-secret account metadata, recovery procedures, and security checklists.

> TinyNote stores readable Markdown files and is not a dedicated encrypted password vault. Keep actual passwords, recovery codes, and other secrets in a trusted password manager; use TinyNote for non-secret workflows and references.

## Choose the right boundary

Create a new space when a subject has its own vocabulary, workflows, or review rhythm. Keep a subject as a group when it still shares the same working context as its parent space.

A useful rule: **spaces separate worlds; groups organize material within a world; notes capture the actual knowledge.**

## Try it now

Create one space for an area you return to every week. Give it a recognizable icon, add two or three groups, and move or create one useful note there. TinyNote becomes more valuable as each space develops a clear purpose.
`;

const blocksFeature = `# Block Notes: Reuse at the Speed of Copy and Paste

Block notes are designed for knowledge you expect to use again. Instead of searching through a long document, each useful item becomes a titled, tagged, movable card with a one-click copy action.

## Why blocks work

A good block has one clear job. Its title helps you find it, its content type provides useful highlighting, its tags connect it to similar items, and its body is ready to copy without cleanup.

| Scenario | Example block | Why it helps |
|:--|:--|:--|
| Code snippets | Parse a date, retry a request, center a layout | Copy tested code without reopening an old project |
| Sales talk tracks | Discovery question, objection response, follow-up message | Keep approved language consistent and easy to adapt |
| Common commands | Deploy preview, inspect logs, repair a Git branch | Reduce memory load and typing errors |
| Bookmarks | Design tools, research sources, internal dashboards | Group useful links with titles, tags, and context |
| Templates | Meeting recap, bug report, release checklist | Start recurring work from a reliable structure |

## A practical block workflow

1. **Capture** one reusable item instead of an entire topic.
2. **Name** it by the result you want, such as “Docker: follow service logs.”
3. **Choose a content type** so code, JSON, SQL, Markdown, or shell text is easy to scan.
4. **Tag** by context and purpose rather than creating too many folders.
5. **Copy and use** it directly from list or card view.
6. **Improve the original** whenever real use reveals a better version.

## Sales and support libraries

Blocks are especially effective for language that must stay consistent but still feel personal. Keep separate blocks for opening questions, qualification prompts, product explanations, common objections, and follow-up messages. Copy the closest block, adapt the details, and feed improvements back into the source.

Never store sensitive customer data in a reusable block. Keep examples generic and remove personal information before saving.

## Bookmark collections with context

A raw bookmark tells you where a page is. A block can also tell you **why it matters**, when to use it, and which project it supports. TinyNote can detect links in a block, open a single link directly, or show a list when the block contains several URLs.

## The test for a good block

Ask: “Could I copy this block tomorrow and use it with little or no editing?” If yes, it is probably the right size. If not, split it, clarify the title, or turn the larger explanation into a Markdown or article note.
`;

const SAMPLE_FILES: readonly OfficialSampleFile[] = [
  { relativePath: '01 Start Here/Welcome to TinyNote.blk.md', content: welcomeBlocks },
  { relativePath: '01 Start Here/Markdown Field Guide.mk.md', content: markdownGuide },
  { relativePath: '02 Software Highlights/Spaces for Every Part of Life.mk.md', content: spacesFeature },
  { relativePath: '02 Software Highlights/Block Notes Made for Reuse.writer.md', content: blocksFeature },
  { relativePath: '03 Workflows/Project Launch.blk.md', content: projectBlocks },
  { relativePath: '03 Workflows/A Quiet Weekly Review.writer.md', content: weeklyReview },
  { relativePath: '04 Reference/Code and Command Cookbook.blk.md', content: cookbookBlocks },
];

const cookbookContents: readonly { content: string; contentType: ContentType; tags: string[] }[] = [
  { content: 'docker compose logs --follow --tail=100', contentType: 'bash', tags: ['docker', 'command'] },
  { content: 'git log --oneline --graph --decorate --all', contentType: 'bash', tags: ['git', 'command'] },
  { content: `.centered {
  display: grid;
  min-height: 100dvh;
  place-items: center;
}`, contentType: 'css', tags: ['css', 'snippet'] },
  { content: `from collections import defaultdict

grouped = defaultdict(list)
for item in items:
    grouped[item["category"]].append(item)`, contentType: 'python', tags: ['python', 'snippet'] },
  { content: `name: checks
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test`, contentType: 'yaml', tags: ['yaml', 'ci'] },
];

function buildLocalizedFiles(copy: LocalizedStarterCopy): OfficialSampleFile[] {
  const welcome = copy.welcomeBlocks.map((item) => block(
    item.title,
    item.content,
    item.contentType ?? 'text',
    item.tags ?? [],
  )).join('\n\n');
  const project = copy.projectBlocks.map((item) => block(
    item.title,
    item.content,
    item.contentType ?? 'text',
    item.tags ?? [],
  )).join('\n\n');
  const cookbook = copy.cookbookTitles.map((title, index) => {
    const example = cookbookContents[index];
    return block(title, example.content, example.contentType, example.tags);
  }).join('\n\n');

  return [
    { relativePath: `${copy.groups[0]}/${copy.noteNames[0]}.blk.md`, content: welcome },
    { relativePath: `${copy.groups[0]}/${copy.noteNames[1]}.mk.md`, content: copy.markdownGuide },
    { relativePath: `${copy.groups[1]}/${copy.noteNames[2]}.mk.md`, content: copy.spacesFeature },
    { relativePath: `${copy.groups[1]}/${copy.noteNames[3]}.writer.md`, content: copy.blocksFeature },
    { relativePath: `${copy.groups[2]}/${copy.noteNames[4]}.blk.md`, content: project },
    { relativePath: `${copy.groups[2]}/${copy.noteNames[5]}.writer.md`, content: copy.weeklyReview },
    { relativePath: `${copy.groups[3]}/${copy.noteNames[6]}.blk.md`, content: cookbook },
  ];
}

export function getOfficialSampleLibraryDefinition(
  locale: AppLocale,
): { spaceName: string; files: readonly OfficialSampleFile[] } {
  if (locale === 'en') return { spaceName: SPACE_NAME, files: SAMPLE_FILES };
  const copy = LOCALIZED_STARTER_COPIES[locale];
  return { spaceName: copy.spaceName, files: buildLocalizedFiles(copy) };
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
