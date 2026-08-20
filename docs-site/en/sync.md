# Git sync

Git sync is a [TinyNote Pro](/en/pro) feature. After you unlock it, the library can be a normal Git repository. Pull, commit, and push from the app.

![Git sync settings](/screenshots/sync.png)

## When to use it

- The same notes on multiple computers
- Host the library on GitHub, Gitea, Gitee, or similar
- You want commit history and diffs, not just folder copies

Sync covers files in the library (mostly `.md` and workspace config). AI API keys stay on the device and are never pushed.

## Setup

1. Confirm the library folder in Settings → Data
2. Initialize it as a Git repo and set `origin`
3. Open Settings → Sync in TinyNote

If you see “not a Git repository”:

```bash
cd /path/to/tinynote-library
git init
git remote add origin git@github.com:you/tinynote-notes.git
```

Make sure `.git` exists in that folder.

## Desktop

Desktop TinyNote uses system Git (SSH and HTTPS).

- SSH remotes use your existing keys; no token in the app
- HTTPS uses your OS credential helper or account as usual

The sync page shows the library path, remote URL, branch, pending `.md` changes, ahead/behind counts, and a generated commit message.

| Action | What it does |
| --- | --- |
| Refresh | Re-read repo status |
| Pull | `git pull` |
| Commit and push | Commit changes and push |
| View diff | Preview one file |
| Revert | Restore one file to HEAD; newly added files are deleted |

On conflicts or auth errors, use the terminal hints (`git pull` / `git status`).

## Web

The web app uses isomorphic-git. It supports **HTTPS + token only**, plus a CORS proxy. SSH remotes are not supported in the browser.

## Suggested workflow

1. Pull before you start
2. Edit notes as usual
3. Review the change list, then commit and push
4. On the other machine, pull first

Two people editing the same notebook can still conflict. Resolve those in a Git client or the terminal.
