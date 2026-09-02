---
title: TinyNote Settings Guide
description: Configure TinyNote language, themes, data paths, shortcuts, backup, sync, and Pro features.
---

# Settings

Open the gear at the bottom of the space bar, or File → Settings….

Sections: General, Data, Sync, Backup, Shortcuts, Pro, Samples, Feedback, About. Sync and backup have their own pages.

## General

| Option | Meaning |
| --- | --- |
| Display language | UI language; follows the system until you override it |
| Color theme | Aurora Blue, Slate Teal, Sakura Pink, Paper Gray, Matcha (default) |
| Dark mode | Light / dark, remembered |
| Show space bar | Hide for a calmer notes-focused layout |
| Space group display | Disabled, dropdown, or collapse |
| Hide element borders | Minimal chrome |
| Default view | List / card / compact |
| Interface zoom | Scale the UI |

View menu can also toggle the sidebar and directory pane.

## Data

This page manages paths, not note content.

- **Current library folder**: the storage root chosen on first launch
- **Current app folder**: runtime directory
- **Workspace registry**: which libraries this machine has opened; stored in the home directory, not in the library
- **Current workspace config**: stored in the library and can sync with Git

Changing the storage folder does not move files. Back up or copy the old folder first.

You can copy a path or reveal it in the system file manager.

## Sample library

Samples is its own settings page. The same dialog also appears after you first pick a storage folder.

Importing adds a starter space: welcome, Markdown guide, spaces and block notes, workflows, and a command cookbook. It covers block, Markdown, and article notes. Existing files are not overwritten. The copy follows the UI language.

## Shortcuts

Modifier is <kbd>Cmd</kbd> on macOS and <kbd>Ctrl</kbd> on Windows / Linux.

| Shortcut | Action |
| --- | --- |
| <kbd>Cmd/Ctrl</kbd> + <kbd>P</kbd> | Recent notes |
| <kbd>Cmd/Ctrl</kbd> + <kbd>F</kbd> | Search in workspace |
| <kbd>Cmd/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd> | Global search |

## Feedback

Copy platform and version diagnostics, then email a report. Include that text when you file a bug.

Email: [tinynote-app@wu2kong.com](mailto:tinynote-app@wu2kong.com)

Or open a [GitHub Issue](https://github.com/wu2kong/tinynote-app/issues).

## About and updates

The About page shows the version and can check for updates:

- **macOS / Windows**: native updater dialog (GitHub first, Qiniu Cloud if GitHub is unreachable)
- **Otherwise**: get the installer from the [download page](https://tinynote.wu2kong.com/download.html)

TinyNote → Check for Updates… is the same entry.
