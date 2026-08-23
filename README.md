# TinyNote

**A local-first snippet notebook for developers. Save commands, prompts, configs, and reusable notes, then copy any block in one click.**

TinyNote 轻记是一款面向开发者与效率用户的轻量级笔记工具。它适合管理 Shell 命令、代码片段、Prompt 模板、JSON 配置、账号备忘和每天反复取用的零碎知识。

English · [简体中文](README.zh-CN.md)

[![Latest release](https://img.shields.io/github/v/release/wu2kong/tinynote-app?label=release&style=flat-square)](https://github.com/wu2kong/tinynote-app/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/wu2kong/tinynote-app/total?style=flat-square)](https://github.com/wu2kong/tinynote-app/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Built with Tauri](https://img.shields.io/badge/Built%20with-Tauri-24C8DB?style=flat-square)](https://tauri.app/)

[Website](https://tinynote.wu2kong.com/) · [Download](https://github.com/wu2kong/tinynote-app/releases/latest) · [Docs](https://tinynote.wu2kong.com/docs/app) · [Issues](https://github.com/wu2kong/tinynote-app/issues)

## Why TinyNote

Most note apps are built for long documents. TinyNote is built for the short things you reuse all day.

| Feature | What it means |
| --- | --- |
| 5-10 MB installer | Lightweight desktop app built with Tauri |
| One-click copy | Copy a note title, body, or full block without selecting text |
| Local-first Markdown | Your notes stay as local Markdown files |
| Fast search | Search both notebooks and note blocks quickly |
| Git sync | Sync with GitHub, GitLab, Gitee, Codeup, AtomGit, or TinyNote hosted Git |
| Cross-platform | macOS, Windows, and Linux releases |

TinyNote is not only a snippet manager. It is evolving into a focused notebook and personal knowledge-management workspace where capture, organization, retrieval, sync, and reuse stay fast.

## Screenshots

![TinyNote light mode](screenshots/1.iShot_亮色模式.png)

![TinyNote dark mode](screenshots/2.iShot_暗色模式.png)

## Use Cases

- Shell command manuals and terminal snippets
- API examples, JSON configs, SQL fragments, and code templates
- Prompt libraries for AI workflows
- Operations notes, server commands, and troubleshooting checklists
- Frequently copied text that is annoying to find inside long documents

## Features

- **Block notebooks**: organize snippets as independent note blocks with their own copy buttons.
- **Markdown notes**: write and edit regular Markdown files.
- **Article notes**: use a focused writing mode for longer content.
- **Hierarchical organization**: spaces, groups, notebooks, and note blocks.
- **Drag and drop sorting**: reorder spaces, groups, notebooks, and note blocks.
- **Local backup**: export your workspace as a local archive.
- **AI chat**: connect OpenAI-compatible providers while keeping API keys on your machine.
- **Multiple themes**: light, dark, paper, matcha, sunset, and more.
- **Internationalization**: Simplified Chinese, Traditional Chinese, English, Japanese, Korean, German, French, Italian, and Russian.

## Download

TinyNote is free to download and does not require an account.

- [GitHub Releases](https://github.com/wu2kong/tinynote-app/releases/latest)
- [Mirror for users in China](https://www.ilanzou.com/s/B6uXlvhu)

Supported platforms:

| Platform | Packages |
| --- | --- |
| macOS | `.dmg`, `.app.tar.gz` |
| Windows | `.exe`, `.msi` |
| Linux | `.deb`, `.rpm`, `.AppImage` |

Planned distribution channels include the Mac App Store, Microsoft Store, iOS, and Android.

## Development

Requirements:

- Node.js
- npm
- Rust and Tauri prerequisites

Run the app locally:

```bash
npm install
npm run dev
npm run tauri dev
```

Build the web frontend:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Build desktop packages:

```bash
npm run tauri build
```

## Documentation

- User guide: [tinynote.wu2kong.com/docs/app](https://tinynote.wu2kong.com/docs/app)
- Docs source: [docs-site](docs-site/README.md)

Run the docs locally:

```bash
npm run docs:dev
```

## Roadmap

- Mac App Store and Microsoft Store distribution
- iOS and Android apps
- iCloud, Dropbox, and more cloud-drive sync options
- More note formats, including checklists and mind maps
- More import/export formats
- Better keyboard-first workflows
- More sync providers and conflict-resolution UI improvements
- Community theme presets
- Better onboarding examples for developers

## Contributing

Issues and pull requests are welcome. If you are not sure where to start, open a feature request or pick an issue labeled `good first issue`.

Before opening a pull request, please run:

```bash
npm test
npm run build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for more details.

## Author

Made by [悟二空](https://wu2kong.com) · [GitHub](https://github.com/wu2kong)

## License

TinyNote is released under the [MIT License](LICENSE).
