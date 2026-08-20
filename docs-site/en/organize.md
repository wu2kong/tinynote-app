# Organize notes

TinyNote maps to real folders: a space is a directory ending with `.tinynotes`, subfolders are groups, and `.md` files are notes.

## Four levels

```text
Space (.tinynotes folder)
  └── Folder (unlimited nesting)
        └── Note (.md file)
              └── Note block (one copyable item inside the file)
```

### Spaces

A space is a work context such as Work or Personal. The free plan allows up to 5 spaces; [Pro](/en/pro) has no limit.

You can create, rename, delete, and change icons; open or copy the folder path; and put spaces into groups (dropdown or collapse — see [Settings](/en/settings)).

### Folders

Folders are normal directories and can nest freely. The context menu covers new child folders, rename, delete, move, and Reveal in Finder/Explorer.

Deleting a folder deletes the notes inside. This cannot be undone.

### Notes

| Format | What it is | Plan |
| --- | --- | --- |
| Block notebook | Many independently copyable blocks in one file | Free |
| Markdown note | A full Markdown document | Pro; 1 sample per space on Free |
| Article note | WYSIWYG writing | Pro; 1 sample per space on Free |

Free plan: 100 notes per space.

## Note blocks

A block is the copy unit inside a block notebook.

- **Add**: from the notes pane; types include text, Markdown, JSON, Bash, SQL, Python, and more
- **Copy body**: the copy button on the block
- **Copy title + body / whole block**: context menu
- **Paste as note**: clipboard content in TinyNote block format becomes a new block
- **Reorder**: drag in the notes pane
- **Duplicate**: copy a block or an entire notebook
- **Extract links**: list URLs from the body

The properties pane edits title, body, tags, and content type. Use the fullscreen editor for longer text. JSON/SQL can be formatted; Markdown has a preview.

## Views

- **List**: title + preview
- **Card**: more detail
- **Compact**: denser list for large notebooks

Set the default under Settings.

## Source mode

Block notebooks can switch to source mode to edit the underlying Markdown. Use it for bulk frontmatter edits. Save & parse rebuilds blocks. Invalid source may fail to parse — keep a Git copy.

## Search

| Entry | Shortcut (macOS / others) | Scope |
| --- | --- | --- |
| Directory search | — | Note names in the current space |
| Notes search | — | Blocks in the current note |
| Workspace search | <kbd>Cmd+F</kbd> / <kbd>Ctrl+F</kbd> | Current workspace |
| Global search | <kbd>Cmd+Shift+F</kbd> / <kbd>Ctrl+Shift+F</kbd> | Whole library |
| Recents | <kbd>Cmd+P</kbd> / <kbd>Ctrl+P</kbd> | Open history |

Global search can match space name, note name, block title, or block body.

## Drag and drop

Spaces, folders, notes, and blocks can be reordered by dragging. “Move to…” relocates a note. Real filesystem paths update with the tree.
