# TinyNote Mobile (Flutter)

iOS / Android 客户端，与桌面端共用同一套底层存储格式：

- 库根目录下的 `*.tinynotes` 空间目录
- 分组为普通文件夹
- 笔记本为 `.md` / `.blk.md` 文件；桌面端的 `.mk.md`、`.writer.md` 按整篇文章读写，不会再拆成块后写回
- 块笔记本的笔记块为 Markdown frontmatter（与桌面端 `noteParser` 一致）

## 环境要求

- [Flutter SDK](https://docs.flutter.dev/get-started/install)（3.7+）
- iOS 真机调试需要 **Xcode** + Apple 开发者账号（免费账号即可）

仓库内已包含本地 Flutter SDK（`.flutter-sdk/`，已在根 `.gitignore` 忽略）。若你本机未安装 Flutter，可先：

```bash
export PATH="$PWD/../.flutter-sdk/bin:$PATH"   # 在 mobile/ 目录下执行
```

或自行安装 Flutter 并加入 `PATH`。

## 快速开始

```bash
cd mobile
flutter pub get
flutter run
```

连接 iPhone 后，`flutter devices` 应能看到设备，然后：

```bash
flutter run -d <device-id>
```

## 项目结构

```
mobile/
  lib/
    core/          # 与桌面端一致的解析与文件逻辑
    storage/       # 本地文件存储（path_provider + dart:io）
    services/      # 库初始化与状态
    screens/       # 页面
    widgets/       # 组件
  ios/             # 由 flutter create 生成
  android/
```

## 存储位置

- **iOS / Android 默认**：应用 Documents 目录下的 `tinynote-library/`
- **iOS 云盘同步（可选）**：通过系统 Files 选择 iCloud 云盘文件夹作为库根（个人开发者账号可用，无需 iCloud Capability）
- 首次启动会自动创建示例空间「示例.tinynotes」
- 与桌面端格式兼容

## 功能（相对桌面端）

| 能力 | 移动端 | 桌面端 |
| --- | --- | --- |
| 块笔记本浏览 / 复制 | ✓ | ✓ |
| Markdown / 文章笔记 | 按整篇打开，避免写坏文件 | ✓ 专用编辑器 |
| Git / AI / Pro / 官方样例库 | ✗ | ✓ |
| iCloud 文件夹同步 | iOS | 规划中 |

- 浏览空间 / 分组 / 笔记本
- 查看 / 编辑笔记块，一键复制标题或内容
- **设置中心**：开启 / 关闭云盘文件夹同步，查看当前库路径

## iCloud / 云盘同步（iOS）

个人免费开发者账号**不支持** App 专属 iCloud 容器 Capability，因此采用 Files 文件夹授权：

1. 真机登录 Apple ID，并开启 **iCloud 云盘**
2. 侧栏 → **设置** → 打开 **iCloud / 云盘同步**
3. 在文件选择器中进入 **iCloud 云盘**，新建或选中一个文件夹（如 `TinyNote`）
4. 其他设备对同一文件夹开启同步即可共用；桌面端也可直接打开该目录

> 请用真机验证。Android 暂不支持。

## 后续扩展

- [ ] Git 同步
- [ ] Android 外部目录 / 云盘同步
