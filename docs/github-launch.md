# TinyNote GitHub Launch Checklist

Use this checklist when you are ready to push a new release and promote the project.

## GitHub Repository Settings

Recommended description:

```text
TinyNote is a local-first snippet notebook for developers. Save commands, prompts, configs, and copy any block in one click.
```

Recommended topics:

```text
tauri
react
typescript
markdown
notes-app
note-taking
local-first
offline-first
developer-tools
productivity
clipboard
snippets
git-sync
icloud
dropbox
knowledge-management
pkm
macos
windows
linux
```

Recommended settings:

- Enable Discussions.
- Add `good first issue` labels to small documentation, translation, and UI-polish tasks.
- Pin the latest release.
- Make sure the website link is set to `https://tinynote.wu2kong.com`.
- Confirm GitHub detects the MIT license after pushing the `LICENSE` file.

## Launch Sequence

1. Push README, LICENSE, CONTRIBUTING, and issue template changes.
2. Publish or update the latest GitHub Release.
3. Create 3-5 beginner-friendly issues before posting anywhere.
4. Post to developer communities within the same 24-hour window.
5. Reply quickly to comments and issues during the first day.

## Suggested First Issues

- Improve English copy in the README and docs.
- Add more screenshots for sync and backup flows.
- Add keyboard shortcut documentation.
- Add more official sample notes for developers.
- Improve Linux installation instructions.
- Add a short demo GIF to the README.
- Translate more docs into Chinese and English.
- Draft UX proposals for checklist and mind-map note formats.
- Research iCloud and Dropbox sync options.

## Launch Copy

Short English version:

```text
I built TinyNote, an 8MB local-first snippet notebook for developers.

It is made for the small things you copy all day: shell commands, JSON configs, SQL fragments, prompt templates, and troubleshooting notes.

Notes stay as local Markdown files, and every block has its own copy button.

GitHub: https://github.com/wu2kong/tinynote-app
```

Short Chinese version:

```text
我做了一个 5-10MB 的本地优先笔记工具 TinyNote，专门管理开发者每天反复复制的零碎片段：Shell 命令、JSON 配置、SQL、Prompt 模板、排障记录等。

每个笔记块都有独立复制按钮，数据存在本地 Markdown 文件里，也支持 Git 同步。

后续会继续支持 Mac App Store、Microsoft Store、iOS、Android、iCloud/Dropbox 同步，以及清单、脑图等更多笔记格式。目标不是只做块笔记，而是让专注笔记和知识管理更高效。

GitHub: https://github.com/wu2kong/tinynote-app
```

Show HN version:

```text
Show HN: TinyNote - a local-first snippet notebook for developers

TinyNote is a small desktop app for the snippets developers copy all day: shell commands, JSON configs, SQL fragments, prompt templates, and troubleshooting notes.

It stores notes as local Markdown files, supports Git sync, and lets you copy any note block in one click.

I built it with Tauri, React, TypeScript, and Rust.

GitHub: https://github.com/wu2kong/tinynote-app
Website: https://tinynote.wu2kong.com/
```

## Places to Post

- V2EX: `分享创造`
- 掘金: 前端 / 工具 / 开源
- Hacker News: Show HN
- Reddit: `r/opensource`, `r/productivity`, `r/selfhosted`, `r/Tauri`
- X / Twitter: short demo video or GIF plus the GitHub link
- Product Hunt: only after the README has a demo GIF and the website is polished

## What to Watch

GitHub shows repository traffic for the past 14 days under `Insights -> Traffic`.

Track:

- Unique visitors
- Referring sites
- Popular content
- Release download counts
- Stars gained per day
- Issues opened by new users

If visitors are low, distribution is the problem. If visitors are high but stars are low, README positioning and demo quality are the problem.
