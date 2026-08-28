---
title: TinyNote Changelog
description: See TinyNote feature updates, fixes, and improvements by version.
---

# Changelog

Installers: [download page](https://tinynote.wu2kong.com/download.html).

## v1.2.7

2026-08-28

### Fixes

- Git conflict copies now keep the original folder and put the conflict marker before the notebook suffix, e.g. `公众号注册和定位（冲突版本 2026-08-28）.writer.md`

## v1.2.6

2026-08-27

### New features

- Note blocks can be configured to copy their body on double-click
- The mobile app can connect to the same Git repository with an HTTPS URL and access token, then pull or commit-and-push
- Mobile now supports Markdown notebooks and document notebooks, aligned with desktop
- Mobile can import the official sample library or notes from files, and includes a feedback entry
- Improved iOS / iPadOS large-screen layout

### Improvements

- Git sync is built into the app, so desktop no longer depends on a system Git install
- Unsupported notebook formats show a safe prompt instead of interrupting unexpectedly

## v1.2.5

2026-08-25

### New features

- Cloud-drive sync: put the library in a folder already synced by iCloud, Nutstore, OneDrive, or similar; the desktop client handles upload and download
- On Git pull conflicts, the cloud version stays in the original file and your local content is saved as a "conflict version" copy so nothing is lost
- AI settings can add multiple custom providers, so several OpenAI-compatible services can be used at once

### Improvements

- Sync settings are redesigned: Git versus cloud drive is easier to choose, and source lists plus everyday actions are clearer

### Fixes

- Fix unreadable auto-update notes in Windows dark mode

## v1.2.4

2026-08-22

### New features

- Git sync now includes TinyNote official hosting (git.wu2kong.com), with in-app sign-in, repo selection, and creating a new repository

### Improvements

- Updates check GitHub first and fall back to Qiniu Cloud when GitHub is unreachable; Lanzou Cloud remains a manual backup
- Clearer loading feedback while checking for updates and downloading installers
- About page now lists the official download page, GitHub Releases, and the mirror
- Sample library is a dedicated Settings page instead of living under Data
- AI model providers can be added or removed as needed, with a more compact layout

### Fixes

- Fix update checks failing when GitHub is unreachable
- Fix the Check for Updates button appearing unresponsive

## v1.2.3

2026-08-21

- Git sync across GitHub, Gitee, GitLab, Alibaba Cloud Codeup, AtomGit, and custom remotes, with in-app sign-in, repo setup, and one-click add/remove
- New installs default to the Matcha Green theme
- Remove the unused Edit item from the system menu

## v1.2.2

2026-08-21

- Import Markdown notes and folders from the menu, directory panel, or by dropping them onto the window (plain `.md` becomes an article note)
- Export the entire note library from the system menu
- Import the official starter sample library after choosing a storage folder, or later from Settings
- Fix switching between workspaces
- Open external links in Markdown preview with the system browser
- Cleaner system menu, including recent workspace management

## v1.2.1

2026-08-20

- Convert between article notes and Markdown notes from the context menu (suffix and editor view only)
- Help center, with a system menu entry
- Fix note content being overwritten by save debounce
- Sparkle auto-update on macOS and WinSparkle on Windows

## v1.2.0

2026-08-19

- Three note formats: block notebooks plus Markdown notes and WYSIWYG article notes
- UI languages: zh-Hans, zh-Hant, English, Japanese, Korean, German, French, Italian, Russian, following the system language
- Space groups with dropdown or collapse display
- Feedback page: copy diagnostics and compose an email
- Better global search entry, group interactions, and article note editing

## v1.1.0

2026-07-21

- AI chat sessions
- Configurable model providers
- Stronger note editing
- Recents / history shortcuts
- Workspace and settings improvements
- Better notebook clicks, search, and context menus

## v1.0.8

2026-06-18

- More reliable Git
- Move `configs.json` to the library root
- Freely resizable sidebar

## v1.0.7

2026-06-16

- Theme switching
- Global search
- Duplicate notebooks

## v1.0.6

2026-06-15

- Updated app icon

## v1.0.5

2026-06-13

- Fix updater download failures by using a native Rust download
- Manual download link to the GitHub Release page

## v1.0.4

2026-06-13

- Backup and sync features
