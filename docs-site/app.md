---
title: TinyNote 轻记应用概述
description: TinyNote 轻记是一款面向开发者的轻量级笔记与快捷复制工具，用于管理命令、代码片段和配置模板。
---

# TinyNote

TinyNote 轻记是一款轻量级笔记管理与快捷复制工具，帮助你整理命令、代码片段、配置模板和日常备忘。它专注「零碎片段的高频取用」，与 Notion、印象笔记等长文工具互补，而不是替代。

安装包约 5~10 MB，支持 macOS、Windows 与 Linux，数据保存在本地 Markdown 文件中，无需注册账号。

![TinyNote 浅色界面](/screenshots/light.png)

## 适合做什么

- Shell 命令手册、API 片段库、Prompt 模板
- 运维脚本、配置片段、账号备忘
- 每天反复复制、不想每次翻长文档框选的内容

不适合写长文协作文档、复杂知识图谱或重度富文本排版。那些场景请继续使用 Notion、Obsidian 等工具。

## 核心能力

- **快捷复制**：一键将笔记块送入剪贴板，可复制正文、标题或完整笔记
- **四层组织**：空间 → 目录 → 笔记 → 笔记块，支持无限嵌套
- **三种笔记格式**：块笔记本、Markdown 笔记、文章笔记（后两种为高级版）
- **三种视图**：列表、卡片、紧凑
- **本地 Markdown**：目录结构映射真实文件夹，可用 Git 或任意编辑器管理
- **Git 同步与本地备份**：多设备协作或一键打包归档
- **AI 问答**：接入 OpenAI 兼容模型，在应用内提问
- **多语言**：简体中文、繁體中文、English、日本語、한국어、Deutsch、Français、Italiano、Русский

## 界面布局

主界面为四栏工具型布局：

| 栏 | 作用 |
| --- | --- |
| 空间栏 | 切换空间、主题、设置，以及全局搜索入口 |
| 目录栏 | 浏览目录与笔记，支持搜索、右键菜单、拖拽 |
| 笔记栏 | 展示当前笔记中的笔记块，切换视图并一键复制 |
| 属性栏 | 编辑标题、正文、标签与内容类型 |

浅色与深色主题可随时切换：

![TinyNote 深色界面](/screenshots/dark.png)

## 数据如何存放

你首次启动时选择一个存储文件夹（笔记库）。之后的结构类似：

```text
笔记库/
  ├── 工作空间.tinynotes/
  │   ├── 目录/
  │   │   └── 笔记本.md
  │   └── 另一本笔记.md
  └── configs.json
```

块笔记本使用 Markdown 扩展格式，多个笔记块写在同一个 `.md` 文件里，用 frontmatter 分隔：

```markdown
---
title: 常用命令
contentType: bash
tags: [shell]
createdAt: 2026-08-20T12:00:00Z
updatedAt: 2026-08-20T12:00:00Z
---

git status
```

因此笔记库本身就是普通文件，可以放进 Git、用 VS Code 打开，或拷到另一台电脑继续用。

## 下载安装

支持 **macOS / Windows / Linux**，免费开源。

- [前往下载页](https://tinynote.wu2kong.com/download.html)
- [产品主页与 Pro 购买](https://tinynote.wu2kong.com/)

安装包形态：

| 平台 | 推荐格式 |
| --- | --- |
| macOS | Universal `.dmg` |
| Windows | `.exe` 安装包，也可使用 `.msi` |
| Linux | `.deb` / `.rpm` |

## 下一步

1. [快速上手](/quickstart)：从安装到第一条可复制笔记
2. [组织与笔记](/organize)：空间、目录、笔记格式与复制
3. [设置手册](/settings)：语言、主题、快捷键与数据路径
