# TinyNote 上架 Mac App Store

本项目的 Bundle ID 按分发渠道区分：

- 应用商店版（Mac App Store / iOS / Android）：`com.wu2kong.tinynote.app`
- 官网下载版（Tauri 直签）：`com.wu2kong.tinynote`

Mac App Store 相关标识：

- Bundle ID：`com.wu2kong.tinynote.app`
- Team ID：`2S49AWBH4X`
- App ID：`2S49AWBH4X.com.wu2kong.tinynote.app`
- App Store 分类：Productivity

Mac App Store 构建会启用 App Sandbox、关闭 Sparkle 与站外授权/购买界面，并把用户通过系统对话框选择的工作区授权持久化。官网下载版仍保留 Sparkle 更新能力。

日常开发、测试、编译和发布时，先看 [分发路线总览](./DISTRIBUTION_WORKFLOWS.md)。它明确区分官网版与 Mac App Store 版，并说明为什么 `npm run dev:appstore` 不能直接测试 IAP。

## 1. 在 Apple Developer 注册 App ID

打开 [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list)：

1. 点击 `Identifiers` 右侧的 `+`。
2. 选择 `App IDs`，再选择 `App`。
3. Description 填 `TinyNote`。
4. Bundle ID 选择 `Explicit`，填 `com.wu2kong.tinynote.app`。
5. Capabilities 勾选 `App Sandbox`，然后注册。

如果后台已经存在完全相同的 Explicit App ID，请直接复用，不要再创建。官网直发包使用的 `com.wu2kong.tinynote` 是另一套标识，不要与商店版混用。

## 2. 创建并安装两个证书

需要两个不同用途的证书，而且都必须带有本机私钥：

- `Apple Distribution`：签名 `.app`。
- `Mac Installer Distribution`：签名提交给 App Store Connect 的 `.pkg`。

可以在“钥匙串访问 → 证书助理 → 从证书颁发机构请求证书”生成 CSR，再到 Apple Developer 的 `Certificates` 页面分别申请上述证书。下载 `.cer` 后双击安装到登录钥匙串。CSR 对应的私钥不要导出到仓库，也不要上传或发送给他人。

安装后检查：

```bash
security find-identity -v -p codesigning
security find-certificate -a -c "Mac Installer Distribution" -Z
```

第一条应列出 `Apple Distribution: HAO LI (2S49AWBH4X)` 且不是 `0 valid identities found`。

## 3. 创建 Mac App Store provisioning profile

打开 Apple Developer 的 `Profiles` 页面并点击 `+`：

1. Distribution 选择 `Mac App Store Connect`。
2. App ID 选择 `com.wu2kong.tinynote.app`。
3. 选择刚创建的 `Apple Distribution` 证书。
4. Profile Name 可填 `TinyNote Mac App Store`。
5. 下载 `.provisionprofile` 并双击安装，或在构建时通过 `--profile` 指定路径。

已有的 iOS Development profile 不能用于 Mac App Store。

## 4. 获取证书公钥与指纹

Mac App Store 上架本身不要求单独提交“公钥”。CSR 已包含公钥，私钥保存在本机钥匙串。若第三方后台要求证书公钥或 SHA-256 指纹，可运行：

```bash
security find-certificate -c "Apple Distribution: HAO LI (2S49AWBH4X)" -p > /tmp/tinynote-apple-distribution.pem
openssl x509 -in /tmp/tinynote-apple-distribution.pem -pubkey -noout > /tmp/tinynote-apple-distribution-public-key.pem
openssl x509 -in /tmp/tinynote-apple-distribution.pem -noout -fingerprint -sha256
security find-certificate -c "Apple Distribution: HAO LI (2S49AWBH4X)" -Z
```

- `openssl ... -pubkey` 生成 PEM 格式公钥。
- `openssl ... -fingerprint -sha256` 输出 SHA-256 指纹。
- `security ... -Z` 输出 Apple 工具常见的 SHA-1 指纹。
- `/tmp` 中只有证书与公钥，不包含私钥；用完可删除。

Sparkle 的 `SUPublicEDKey` 是官网下载版更新签名公钥，与 Apple Distribution 证书不是同一把钥匙；商店构建中已经移除。

## 5. 在 App Store Connect 创建 App

在 [App Store Connect](https://appstoreconnect.apple.com/apps) 创建新的 macOS App：

- Platforms：macOS
- Name：TinyNote
- Primary Language：按实际商店文案选择
- Bundle ID：`com.wu2kong.tinynote.app`
- SKU：可使用 `tinynote-macos-001`（仅内部可见）

如果 TinyNote 是付费 App，在 App Store Connect 直接设置价格；如果 App 内出售数字功能，必须接入 Apple In-App Purchase。当前商店构建是完整解锁版，已隐藏站外购买与许可证激活。

## 6. 构建、验证与上传

仅做代码与配置预检：

```bash
npm run build:appstore:prepare
```

生成签名 `.pkg`：

```bash
npm run build:appstore -- --profile /绝对路径/TinyNote.provisionprofile
```

产物位于：

```text
dist-packages/TinyNote-<version>-mac-app-store.pkg
```

推荐使用 Transporter 上传该 `.pkg`。也可以创建 App Store Connect API Key 后运行：

```bash
APPLE_API_KEY_ID="KEY_ID" \
APPLE_API_ISSUER="ISSUER_ID" \
npm run build:appstore -- --profile /绝对路径/TinyNote.provisionprofile --upload
```

`.p8` 私钥应放在 Apple 工具支持的私有目录中，不要放进项目或提交到 Git。

## 7. 本机测试 IAP（不使用 TestFlight）

仓库中的 [`src-tauri/TinyNote.storekit`](../src-tauri/TinyNote.storekit) 提供了一个本地 StoreKit 测试目录，包含与生产代码完全一致的三个产品 ID：

- 月度订阅：`com.wu2kong.tinynote.app.pro.monthly`
- 年度订阅：`com.wu2kong.tinynote.app.pro.yearly`
- 终身版（非消耗型）：`com.wu2kong.tinynote.app.pro.lifetime`

`TinyNote.storekit` 只在 Xcode 的本地 StoreKit 测试环境中生效：Xcode 必须从 Run scheme 启动一个 `.app` bundle，并把该文件设为 StoreKit Configuration。仓库当前没有维护这样的 Tauri Xcode scheme，因此不能把“打开 `.storekit`”与 `npm run dev:appstore` 组合为可用测试路径。

`npm run dev:appstore` 只会启动裸可执行文件；虽然它启用了商店代码，但不会生成 `.app` bundle。若点击购买出现 `IAP requires the app to run from a .app bundle`，这是预期结果，应该改走下方签名 bundle 测试，而不是反复重试 dev 命令。

### 推荐：Sandbox 真机流程

1. 先构建带 Mac App Store profile 的签名包：

   ```bash
   npm run build:appstore -- --profile /绝对路径/TinyNote.provisionprofile
   ```

2. 从生成的 `.app` 启动：

   ```bash
   open "src-tauri/target/universal-apple-darwin/release/bundle/macos/TinyNote.app"
   ```

3. 用 App Store Connect 的 Sandbox 测试账号登录 Mac 的 Sandbox Apple Account 设置；在 app 内购买月度、年度或终身版，验证解锁与“恢复购买”。Sandbox 不会实际扣款。
4. 若应用一打开就显示“高级版已激活”，该测试账号已经有购买记录。在 App Store Connect → 用户和访问 → 沙盒中选中该账号，执行“清除购买历史记录”，然后在 Mac 退出并重新登录该 Sandbox 账号，再重启 app。此操作只影响测试交易、不可撤销。

Sandbox 用于验证 App Store Connect 中的真实商品、订阅状态和恢复购买；不依赖 TestFlight。完整的日常流程见 [DISTRIBUTION_WORKFLOWS.md](./DISTRIBUTION_WORKFLOWS.md)。

## 8. 提交前检查

- 在本机安装并启动商店构建，测试新建、打开、保存工作区以及重启后的授权恢复。
- 在 App Store Connect 填写截图、描述、关键词、支持网址、隐私政策网址、年龄分级与 App Privacy。
- 加密问题：项目的商店 Info.plist 已声明 `ITSAppUsesNonExemptEncryption = false`；提交时仍需按实际网络与加密用途如实回答。
- 如果启用新的 Apple capability，需要同步更新 App ID、provisioning profile 与 `src-tauri/Entitlements.appstore.plist`。
- 上传后先用 TestFlight 内部测试，再提交 App Review。
