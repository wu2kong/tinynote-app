# Git 同步

Git 同步属于 [TinyNote 高级版](/pro)。开通后，笔记库可以作为普通 Git 仓库，在应用内完成拉取、提交和推送。

![Git 同步设置](/screenshots/sync.png)

## 适用场景

- 多台电脑共用同一套笔记
- 把笔记库放在 GitHub、Gitea、Gitee 等远程仓库做云端备份
- 需要提交记录和 diff，而不是只拷贝文件夹

同步的是笔记库目录里的文件（主要是 `.md` 与工作区配置）。AI 的 API Key 只存在本机，不会写入笔记库，也不会被推送。

## 使用前准备

1. 在「设置 → 数据」确认笔记库文件夹
2. 将该文件夹初始化为 Git 仓库，并配置 `origin`
3. 在 TinyNote 中打开「设置 → 同步」

如果提示「未识别为 Git 仓库」：

1. 在终端进入笔记库文件夹
2. 确认存在 `.git`
3. 必要时执行 `git init`，再添加远程仓库

```bash
cd /path/to/tinynote-library
git init
git remote add origin git@github.com:you/tinynote-notes.git
```

## 桌面端

桌面端调用系统 Git，支持 SSH 和 HTTPS。

- SSH（如 `git@github.com:user/repo.git`）走本机已有的密钥和凭据，不必在 TinyNote 里填 Token
- HTTPS 可按远程仓库要求使用账号或凭据助手

同步页可以看到：

- 当前笔记库路径与远程 URL
- 当前分支
- 待提交的 `.md` 变更数量
- 领先 / 落后远程的提交数
- 自动生成的提交信息预览

操作：

| 按钮 | 作用 |
| --- | --- |
| 刷新状态 | 重新读取仓库状态 |
| 拉取最新 | `git pull` |
| 提交并推送 | 提交变更并 push |
| 查看变更 | 预览某个文件的 diff |
| 撤销变更 | 把单个文件恢复到上次提交；新文件则删除 |

冲突或认证失败时，按页面提示在终端手动 `git pull` / `git status` 处理。

## Web 端

Web 端使用 isomorphic-git，只支持 **HTTPS + Token**，不支持 SSH。需要填写 CORS 代理和个人访问令牌。

若主要在浏览器里用 TinyNote，请把远程仓库改成 HTTPS 地址。

## 建议工作流

1. 开始工作前先「拉取最新」，避免分叉
2. 在 TinyNote 里照常编辑笔记
3. 结束时看变更列表，确认没有误改，再「提交并推送」
4. 另一台设备同样先拉取再编辑

多人同时改同一笔记本时，仍可能产生 Git 冲突。冲突需要在终端或外部 Git 工具里解决。
