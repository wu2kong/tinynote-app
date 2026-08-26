# TinyNote iOS：打包并上传 TestFlight

给朋友体验时走这条路。本机插线调试仍用 `flutter run`，不要把开发包发给别人。

| 项目 | 值 |
| --- | --- |
| Bundle ID | `com.wu2kong.tinynote.app`（与 Mac App Store 同一条，不要改成官网版 `com.wu2kong.tinynote`） |
| Team ID | `2S49AWBH4X` |
| App Store Connect | [TinyNote 轻记](https://appstoreconnect.apple.com/apps/6804570106/testflight/ios) |
| 显示名 | TinyNote |
| 签名 | Xcode Automatic Signing（Team 已写在工程里） |
| 导出配置 | `mobile/ios/ExportOptions.plist` |

完整分发路线见 [DISTRIBUTION_WORKFLOWS.md](./DISTRIBUTION_WORKFLOWS.md)。Mac 商店包仍看 [MAC_APP_STORE.md](./MAC_APP_STORE.md)。

## 0. 每次开打之前

- 本机已装 **Xcode**，并在 Xcode → Settings → Accounts 登录付费开发者账号。
- 仓库里的 Flutter 可用：

```bash
export PATH="$PWD/.flutter-sdk/bin:$PATH"   # 在仓库根目录
cd mobile
flutter doctor
```

- `mobile/pubspec.yaml` 的 `version` 必须比上次 **已上传成功** 的构建更高。格式是 `营销版本+构建号`，例如：

```text
1.0.0+2    # 上次已上传
1.0.0+3    # 这次要改成这个
```

`+` 后面的构建号每次上传都要加一；营销版本有产品更新时再改 `1.0.1`。Apple 不允许重复使用同一个构建号。

- 不要删 `Info.plist` 里的这些键，缺了会在处理阶段直接失败：
  - `ITSAppUsesNonExemptEncryption = false`
  - `NSPhotoLibraryUsageDescription`
  - `NSCameraUsageDescription`
  - `NSLocationWhenInUseUsageDescription`

## 1. 本机先跑一遍（可选但建议）

```bash
cd mobile
flutter pub get
flutter devices
flutter run -d <device-id>
```

确认这次要给朋友看的功能在真机上正常。这条是开发签名，只能装到已登记 UDID 的设备，不能发给朋友。

## 2. 打 App Store IPA

在 `mobile/` 下：

```bash
cd mobile
flutter pub get
flutter build ipa --release --export-options-plist ios/ExportOptions.plist
```

大约 2–4 分钟。成功时应看到：

```text
✓ Built IPA to build/ios/ipa
```

产物：

```text
mobile/build/ios/ipa/TinyNote.ipa
```

构建信息校验里应是：

- Version Number：与 `pubspec.yaml` 营销版本一致
- Build Number：与 `+` 后的构建号一致
- Display Name：`TinyNote`
- Bundle Identifier：`com.wu2kong.tinynote.app`

Launch Image 的占位图警告可以忽略，不挡 TestFlight。

## 3. 上传到 App Store Connect

任选一种。推荐 A，不依赖 API Key。

### A. 用刚打好的 archive 直接上传（推荐）

仍在 `mobile/` 下：

```bash
xcodebuild -exportArchive \
  -archivePath build/ios/archive/Runner.xcarchive \
  -exportOptionsPlist ios/UploadOptions.plist \
  -allowProvisioningUpdates
```

看到 `Upload succeeded` 和 `EXPORT SUCCEEDED` 即上传完成。`MinimumOSVersion too low` 只是 2027 年的预告，目前可忽略。

`ios/ExportOptions.plist` 只负责导出 IPA（`destination = export`）；上传必须用 `ios/UploadOptions.plist`（`destination = upload`）。

### B. 拖到 Transporter

打开本机的 **Transporter**，把 `mobile/build/ios/ipa/TinyNote.ipa` 拖进去上传。

## 4. 等处理，再发给朋友

打开 [TestFlight iOS](https://appstoreconnect.apple.com/apps/6804570106/testflight/ios)。

1. 等构建从 Processing 变成 **Ready to Test / 可供测试**（一般 5–20 分钟）。
2. **内部测试**（App Store Connect 用户，例如你自己）：处理完成后即可在 TestFlight 安装，不用外测审核。
3. **发给朋友**（外部测试）：
   1. 测试组用已有的「第一批次公开测试」，或新建外部组。
   2. 把朋友的 **Apple ID 邮箱**加进该组。
   3. 把这次构建勾到该组，提交 **Beta 审核**。首次外测要补联系人姓名、电话、邮箱。
   4. 通过后朋友会收到邮件；iPhone 先装 TestFlight，再点邀请链接。

内部组现在是「构建版本」。朋友不要加进内部组，除非你愿意给他们 App Store Connect 账号。

## 5. 常见失败

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 处理失败，报 Missing purpose string / `NSPhotoLibraryUsageDescription` 或 `NSCameraUsageDescription` | `file_picker` 会引用相册/相机 API | 不要删 `Info.plist` 里对应说明，构建号加一再传 |
| `Redundant Binary Upload` / 构建号已存在 | `pubspec.yaml` 没加构建号 | 把 `+N` 改成 `+N+1` 后重打 |
| 自动签名失败 / Personal Team | Xcode 没登录付费账号，或选错 Team | Xcode → Settings → Accounts 登录 `2S49AWBH4X` |
| 朋友收不到包 | 只加了邮箱、没提交 Beta 审核，或还在处理中 | 等 Ready to Test，再对外测组提交审核 |
| `flutter run` 装上的包想发给朋友 | 开发签名绑死本机设备 | 必须走上面的 IPA + TestFlight |

## 以后自己重打的最短路径

```bash
# 1. 改 mobile/pubspec.yaml：1.0.0+N → 1.0.0+(N+1)
export PATH="$PWD/.flutter-sdk/bin:$PATH"
cd mobile
flutter pub get
flutter build ipa --release --export-options-plist ios/ExportOptions.plist
xcodebuild -exportArchive \
  -archivePath build/ios/archive/Runner.xcarchive \
  -exportOptionsPlist ios/UploadOptions.plist \
  -allowProvisioningUpdates
```

然后打开 [TestFlight iOS](https://appstoreconnect.apple.com/apps/6804570106/testflight/ios)，等处理完成再把朋友加进外部测试组。
