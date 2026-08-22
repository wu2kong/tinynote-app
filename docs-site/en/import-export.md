---
title: Import and export Markdown in TinyNote
description: Import existing Markdown files or folders into TinyNote, or export the whole library.
---

# Import and export

A TinyNote library is a normal folder. Besides creating notes in the app, you can bring in existing Markdown or copy the library out.

## Import Markdown

Use File → Import Notes…, or drag files / folders onto the window.

Rules:

- Files already marked `.blk.md` / `.mk.md` / `.writer.md` keep that format
- Plain `.md` files become article notes (`.writer.md`)
- Importing a folder recreates the folder tree as directories

Notes land in the current space or folder. You can drag them elsewhere afterward.

## Export the library

File → Export Library… copies or packs the current library to a location you choose. Use it when moving machines or handing a snapshot to someone else.

For routine safety nets see [Backup](/en/backup). For other devices see [Git sync](/en/sync).

## Filesystem

Spaces are `.tinynotes` folders and notes are Markdown files, so you can also copy notes in Finder / Explorer, open the library in VS Code, or commit outside the app. Keep block-note frontmatter intact if you edit those files by hand.
