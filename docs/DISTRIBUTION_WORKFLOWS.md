# TinyNote 日常开发、测试与发布路线

TinyNote 有两条**独立**的 macOS 分发路线，以及一条 iOS TestFlight 路线。先判断要验证或交付哪一条，再运行命令；不要把两条 macOS 路线的 Bundle ID、签名、购买方式或安装包混在一起。

| 项目 | 官网下载版 | Mac App Store 版 | iOS TestFlight |
| --- | --- | --- | --- |
| Bundle ID | `com.wu2kong.tinynote` | `com.wu2kong.tinynote.app` | `com.wu2kong.tinynote.app` |
| 收费方式 | 官网购买 + 许可证 | Apple In-App Purchase / StoreKit | 与 Mac 同一组 IAP（月订 / 年订 / 买断） |
| 自动更新 | Sparkle | App Store 自动更新 | TestFlight / 日后 App Store |
| 本地开发启动 | `npm run dev` | `npm run dev:appstore`（只检查界面与集成） | `cd mobile && flutter run` |
| 可测试 IAP 的启动方式 | 不适用 | 已签名的 `TinyNote.app`，不是 `tauri dev` | Xcode StoreKit 配置或真机 Sandbox / TestFlight |
| 交付物 | DMG（以及 Windows/Linux 安装包） | 签名 `.pkg` 上传 App Store Connect | 签名 `.ipa` 上传 TestFlight |
| 发布入口 | GitHub Release / 官网下载 | App Store Connect + App Review | [TestFlight iOS](https://appstoreconnect.apple.com/apps/6804570106/testflight/ios) |

## 先记住这四条

1. 日常功能开发默认走官网版：`npm run dev`。
2. 只要改动了商店专属代码、StoreKit 或购买界面，再运行 `npm run dev:appstore` 做界面和集成检查。
3. `npm run dev:appstore` **不是 IAP 购买测试**：它没有生成 `.app` bundle，点购买会报 `IAP requires the app to run from a .app bundle`。
4. 要实际测试 Mac IAP，必须先构建、签名并从 Finder/`open` 启动 `TinyNote.app`；使用 Sandbox 测试账号，不需要 TestFlight。

---

## A. 官网下载版：日常开发到发布

### 1. 开发

```bash
npm run dev
```

日常写功能、调试窗口和数据读写都从这里开始。官网版保留 Sparkle 更新、官网购买和许可证逻辑。

### 2. 测试

```bash
npm test
npm run build
```

然后在 `npm run dev` 中手动验证本次改动。涉及许可证时，验证：未激活限制、输入许可证、激活后权益、取消激活和重启后的状态。

### 3. 编译安装包

在 macOS 上生成官网版通用 DMG：

```bash
npm run build:packages -- macos
```

产物写入 `dist-packages/`。安装 DMG 后至少验证一次：首次启动、升级覆盖安装、Sparkle 更新检查、许可证激活与本地数据是否保留。

### 4. 发布

确认工作区和测试结果后，在 `main` 分支运行：

```bash
npm run release
```

该脚本会询问新版本号和 Release Notes，更新版本文件、提交、打 tag、推送并创建 GitHub Release；GitHub Actions 随后构建各平台安装包。若只想手动上传本机打出的 DMG，可使用：

```bash
npm run build:packages -- macos --upload vX.Y.Z
```

不要把官网 DMG 上传到 App Store Connect。

---

## B. Mac App Store 版：日常开发到发布

商店版仍使用同一份业务代码，但它是另一份 App：不同 Bundle ID、沙盒权限、购买逻辑和打包格式。

### 0. 一次性准备（证书和后台）

需要已经具备以下内容：

- App Store Connect 中的 macOS App：`com.wu2kong.tinynote.app`；
- 已创建的三个 IAP 产品；
- 登录钥匙串里的 App 签名证书和 Installer 证书及其私钥；
- 对应的有效 `Mac App Store Connect` provisioning profile；
- 至少一个 Sandbox 测试账号。

完整证书、profile 与后台配置见 [MAC_APP_STORE.md](./MAC_APP_STORE.md)。

### 1. 开发：先验证商店专属界面

```bash
npm run dev:appstore
```

这会启用商店版前端、App Sandbox 和 StoreKit 插件，适合检查：商店版不显示官网许可证入口、购买页文案、免费版限制和恢复购买入口。

**不要在这个进程里点购买来判断 IAP 是否正常。** 它是开发用裸进程，不是 `.app` bundle；StoreKit 会拒绝购买请求。

### 2. 提交前代码检查

```bash
npm test
npm run build:appstore:prepare
```

`build:appstore:prepare` 会检查商店版前端、Tauri 配置和 Rust feature，但不会生成可安装的商店包。

### 3. 构建可测试的已签名 `.app`

```bash
npm run build:appstore -- --profile /绝对路径/TinyNote_Mac_App_Store_2026.provisionprofile
```

构建成功后，实际用于本机 IAP 测试的应用在：

```text
src-tauri/target/universal-apple-darwin/release/bundle/macos/TinyNote.app
```

启动它：

```bash
open "src-tauri/target/universal-apple-darwin/release/bundle/macos/TinyNote.app"
```

这是本机测试 IAP 的唯一正确入口。不要把 `src-tauri/target/.../release/app`（裸可执行文件）或 `npm run dev:appstore` 当成 IAP 测试对象。

### 4. 测试真实 IAP（Sandbox，不用 TestFlight）

1. 在 App Store Connect → 用户和访问 → 沙盒，准备一个测试账号；当前团队已有 `test01@wu2kong.com`。Apple 的[创建 Sandbox Apple Account 指引](https://developer.apple.com/help/app-store-connect/test-in-app-purchases/create-a-sandbox-apple-account)说明了账号要求。
2. 在 Mac 的开发者/Sandbox Apple Account 设置中登录该测试账号；出现 StoreKit 付款表单时，如系统要求，也使用这个测试账号登录。
3. 启动上一步构建的已签名 `TinyNote.app`，打开“设置中心 → 高级版”。
4. 依次验证月度、年度、终身版之一的购买表单、完成购买后的解锁、重启后的权益和“恢复购买”。Sandbox 不会实际扣款。
5. 若页面直接显示“TinyNote 高级版已激活”，说明该 Sandbox 账号已有有效交易；要重测首次购买，在 App Store Connect 的 Sandbox 账号列表中选择该账号并执行“清除购买历史记录”，然后在 Mac 退出并重新登录该 Sandbox 账号，再重启 app。

清除购买历史只影响测试交易、不可撤销；不要清除不属于本次测试的账号。Apple 的[Sandbox 账号管理指引](https://developer.apple.com/help/app-store-connect/test-in-app-purchases/manage-sandbox-apple-account-settings/)包含清除后的重新登录要求。

### 5. 关于 `TinyNote.storekit` 与 Xcode

[`src-tauri/TinyNote.storekit`](../src-tauri/TinyNote.storekit) 是本地、离线的 StoreKit 测试数据，适合不连 App Store Connect 时使用。它**只有在 Xcode 用 Run scheme 启动一个 `.app` bundle 并将该文件设为 StoreKit Configuration 时才生效**。

目前仓库没有维护一个可直接运行 Tauri app 的 Xcode scheme，因此它不是日常默认流程；不要只打开该文件后运行 `npm run dev:appstore`，那仍然会得到裸可执行文件错误。日常的真实 IAP 回归测试以第 3、4 步的已签名 `.app` + Sandbox 为准。

### 6. 生成上传包并发布

第 3 步的构建同时生成：

```text
dist-packages/TinyNote-<version>-mac-app-store.pkg
```

发布顺序：

1. 在本机安装/启动该签名 `.app`，完成第 4 步 Sandbox 回归；
2. 使用 Transporter 上传 `.pkg`，或用 `npm run build:appstore -- --profile … --upload`；
3. 等待 App Store Connect 处理构建；
4. 在该 macOS 版本中选择构建，补齐商店文案、截图、隐私、年龄分级、出口合规信息，并把需要随版本审核的 IAP 一并关联；
5. 提交 App Review，审核通过后按选择的发布方式上架。

TestFlight 是可选的后续 beta 分发渠道，不是本机 IAP 开发或 Sandbox 测试的前置条件。

---

## C. iOS TestFlight：打包给朋友体验

iOS 客户端在 `mobile/`，与 Mac 商店版共用 Bundle ID `com.wu2kong.tinynote.app`，上传到同一条 App Store Connect 记录（TinyNote 轻记）。购买通道与 Mac 相同：月度订阅、年度订阅、终身买断，以及恢复购买。提交审核时把这三个 IAP 关联到本次 iOS 版本。

本机插线调试：

```bash
cd mobile
flutter run -d <device-id>
```

发给朋友必须打 IPA 并上传 TestFlight，逐步命令、构建号规则和邀请步骤见 [IOS_TESTFLIGHT.md](./IOS_TESTFLIGHT.md)。最短路径：

```bash
# 先把 mobile/pubspec.yaml 的 version 从 1.0.0+N 改成 1.0.0+(N+1)
export PATH="$PWD/.flutter-sdk/bin:$PATH"
cd mobile
flutter build ipa --release --export-options-plist ios/ExportOptions.plist
```

然后按该文档第 3 节上传，再在 TestFlight 把朋友加进外部测试组。

不要把 `flutter run` 装上的开发包发给朋友；那是设备绑定的开发签名。

---

## 每次改动时怎么选

| 你改了什么 | 至少要跑什么 |
| --- | --- |
| 通用笔记、编辑器、数据功能 | `npm test` + `npm run dev` |
| 官网许可证、官网购买、Sparkle | `npm test` + `npm run dev` + 官网 DMG 安装验证 |
| 商店购买页、产品 ID、Pro 权益、恢复购买 | `npm test` + `npm run dev:appstore` + 已签名 `TinyNote.app` 的 Sandbox 测试 |
| 商店沙盒、权限、签名、Rust feature | `npm run build:appstore:prepare` + 已签名 `TinyNote.app` 启动验证 |
| 任何对外发布 | 对应渠道安装包的干净安装/升级测试，再进入发布步骤 |
| iOS 给朋友体验 / 提交 App Store | `cd mobile && flutter run` 真机确认购买页后，按 [IOS_TESTFLIGHT.md](./IOS_TESTFLIGHT.md) 打 IPA 上传 |

## 常见误区

- **不要混用 Bundle ID**：官网版是 `com.wu2kong.tinynote`，商店版是 `com.wu2kong.tinynote.app`。
- **不要混用购买体系**：商店版不能出现站外许可证/官网收款；官网版不依赖 Apple IAP。
- **不要混用包格式**：官网是 DMG；商店提交的是签名 PKG。
- **不要把 TestFlight 当作本地 IAP 的唯一入口**：签名 `.app` + Sandbox 就能测。
- **不要用裸二进制测 IAP**：任何 “requires the app to run from a .app bundle” 都表示启动方式不对，不是商品配置问题。
