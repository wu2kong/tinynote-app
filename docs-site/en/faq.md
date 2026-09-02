---
title: TinyNote FAQ
description: Answers about TinyNote storage, sync, device migration, Git, backup, updates, and macOS usage.
---

# FAQ

## Where are my notes? Are they uploaded?

They stay in the library folder you chose. TinyNote does not upload notes to a TinyNote server. Files reach the cloud only if you set up [Git sync](/en/sync) to a remote you control.

## How is this different from Notion or Obsidian?

TinyNote is for short snippets and one-click copy. Notion fits long-form collaboration; Obsidian fits linked knowledge bases. Use them together if you want.

## How do I move to a new computer?

1. Copy the whole library folder and point TinyNote at it
2. Use [Git sync](/en/sync) (Pro) and pull the same repo
3. Unzip a [backup](/en/backup) and select that library path

## Notes disappeared after I changed the storage path?

Changing the path does not migrate files. Copy the `.tinynotes` folders to the new location, or switch the path back.

## I hit the space or note limit on Free?

Free allows 5 spaces and 100 notes per space. Delete unused items or upgrade to [Pro](/en/pro). Markdown and article notes allow one sample each per space.

## Git sync is not connected yet?

Open Settings → Sync, choose Git sync, and add a source. TinyNote initializes and authorizes inside the app; you do not need to install Git or use the command line. The web app only supports HTTPS + token.

## Update check failed or download is slow?

Update checks try GitHub first and automatically fall back to Qiniu Cloud if GitHub errors or is unreachable. If both fail, get the installer from the [download page](https://tinynote.wu2kong.com/download.html) or the Lanzou Cloud mirror.

## macOS will not open the app?

Allow it in System Settings → Privacy & Security. Use the Universal `.dmg`. macOS 10.13 or later is required.

## I deleted a note by mistake

In-app delete is usually permanent. If Git sync is enabled, revert from the Sync page. If you have a zip, follow [Restore](/en/backup#restore).

## How do I send feedback?

Settings → Feedback copies version info. Email [tinynote-app@wu2kong.com](mailto:tinynote-app@wu2kong.com) or open a [GitHub Issue](https://github.com/wu2kong/tinynote-app/issues).
