# Quick Start

About two minutes from install to your first copied snippet.

## Install

1. Open the [download page](https://tinynote.wu2kong.com/download.html)
2. Download the package for your OS
3. Install and launch TinyNote

On macOS, if the app is blocked, allow it under System Settings → Privacy & Security.

## First launch

The welcome screen asks you to pick a **storage folder** for the note library.

Tips:

- Choose a durable location such as `~/TinyNote` or an existing Git repo
- Avoid a Downloads folder
- You can change the path later in Settings → Data, but files stay in the old folder unless you move them

After you pick a folder, TinyNote creates a default space and opens the main window.

## Create your first note

1. Select a space in the left bar, or create one
2. In the directory pane, create a **block notebook**, e.g. `Commands`
3. Add a note in the notes pane, fill in a title and body
4. Click the copy button on the block

Daily flow: **search → copy → paste** in the terminal or editor.

## Three ways to find notes

### Search in the current note

The directory search filters note names in the current space. The notes pane search filters blocks in the current notebook.

### Global search

<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> (Windows / Linux: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd>) searches spaces, note names, block titles, and bodies.

### Recents

<kbd>Cmd</kbd>+<kbd>P</kbd> / <kbd>Ctrl</kbd>+<kbd>P</kbd> opens recently used notes.

## A simple first layout

```text
Work.tinynotes/
  ├── Shell/
  │   └── commands.md
  ├── Frontend/
  │   └── snippets.md
  └── prompts.md
```

Spaces are life contexts, folders are topics, notes are groups of copyable items. Split further only when a file gets crowded.

## Next

- [Organize notes](/en/organize)
- [Settings](/en/settings)
- [Git sync](/en/sync)
- [Backup](/en/backup)
