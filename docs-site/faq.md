---
title: TinyNote 常见问题 FAQ
description: TinyNote 笔记存储、云端同步、设备迁移、Git 同步、备份和 macOS 使用问题解答。
---

# 常见问题

## 笔记存在哪里？会不会上传到云端？

默认只存在你选择的本地笔记库文件夹里，应用不会把笔记上传到 TinyNote 服务器。只有你自己配置了 [Git 同步](/sync)，文件才会出现在你指定的远程仓库。

## TinyNote 和 Notion / Obsidian 有什么区别？

TinyNote 面向「短片段 + 一键复制」。Notion 更适合长文和协作，Obsidian 更适合双向链接知识库。可以同时使用：长文档放在其他工具，命令和模板放在 TinyNote。

## 如何换电脑继续用？

任选一种：

1. 把整个笔记库文件夹拷到新电脑，启动后把存储路径指过去
2. 使用 [Git 同步](/sync)（高级版）：新电脑拉取同一仓库
3. 解压 [本地备份](/backup) 的 zip，再选择其中的笔记库路径

## 更换存储目录后笔记不见了？

更换路径不会自动迁移文件。到原目录把 `.tinynotes` 文件夹拷到新位置，或把存储路径改回原来的目录。

## 基础版提示空间或笔记数量上限？

基础版最多 5 个空间、每空间 100 个笔记。删除不用的条目，或升级 [高级版](/pro)。Markdown / 文章笔记每空间可先建 1 篇样例。

## Git 同步提示不是仓库？

笔记库根目录需要有 `.git`。在该目录执行 `git init` 并配置 `origin` 后再刷新同步页。Web 端只支持 HTTPS + Token。

## 检查更新失败或下载很慢？

GitHub 在部分网络环境下不稳定。可改从 [下载页](https://tinynote.wu2kong.com/download.html) 获取安装包，或稍后重试「关于」里的检查更新。

## macOS 打不开应用？

到「系统设置 → 隐私与安全性」允许打开。若仍失败，确认下载的是 Universal `.dmg`，且系统版本不低于 10.13。

## 误删了笔记怎么办？

应用内删除通常不可撤销。若笔记库是 Git 仓库，可用同步页的「撤销变更」或在终端 `git checkout`。若有 zip 备份，按 [备份说明](/backup#恢复) 恢复。

## 如何反馈问题？

「设置 → 反馈」复制版本信息并发邮件到 `lihao317@foxmail.com`，或开 [GitHub Issue](https://github.com/wu2kong/tinynote-app/issues)。
