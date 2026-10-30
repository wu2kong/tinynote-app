# Microsoft Store (MSIX)

TinyNote 的 Microsoft Store 版免费安装，保留官网 Dodo Payments 购买与许可证激活。
采用 MSIX，由 Microsoft Store 签名并提供更新；无需购买 Windows 代码签名证书。

- 产品：TinyNote 轻记 - 本地笔记
- Store ID：`9MXD8FC0031D`
- 产品标识来源：Partner Center → 产品管理 → 产品标识
- 身份配置：`src-tauri/msix/identity.json`
- 新产品后台：https://partner.microsoft.com/zh-cn/dashboard/products/9MXD8FC0031D/overview
- 原 EXE/MSI 产品保留为草稿，不使用它提交 MSIX。

## 构建

在 Windows + PowerShell 7 + Windows SDK + Node.js + Rust 环境运行：

```powershell
npm ci
npm run build:microsoftstore
```

也可运行 `.github/workflows/microsoft-store.yml`。独立发布分支 `codex/microsoft-store` 的代码变更会触发 Windows 构建。
产物位于 `dist-packages/microsoft-store/`，包括 `.msix`、清单和 SHA-256 报告。
上传到商店的 MSIX 不需要自行签名；它不是供官网下载后直接双击安装的 EXE。

构建使用微软官方固定 WebView2 运行时，并验证其主程序的 Microsoft Authenticode 签名。
运行时随包一起分发，因此每次发布都应检查并更新脚本中的 WebView2 版本和下载地址。
MSIX 最低系统版本为 Windows 10 2004（19041），架构 x64。

## 渠道隔离

- `VITE_DISTRIBUTION=microsoft-store`：保留 Dodo 与 AI，隐藏自行下载安装更新的菜单和设置入口。
- Rust `microsoft-store` feature：不加载 WinSparkle，拒绝官网更新下载命令。
- MSIX 使用应用已有的 `com.wu2kong.tinynote` 数据标识。实际桌面文件访问、许可证保存与官网版迁移仍需在 Windows 安装后验证。
- Mac App Store 的 Apple IAP、功能裁剪与沙盒行为保持独立。

## 上架检查

1. 在新产品下上传 MSIX，确认微软包验证通过。
2. 本体价格设为免费；说明 Pro 通过 Dodo Payments 在浏览器中购买，官网许可证可激活。
3. 填写隐私政策、支持地址、收费范围、生成式 AI 声明、年龄评级及商店截图。
4. 审核备注提供免费功能操作步骤，以及专门用于审核的有效 Pro 测试许可证；不要把真实用户许可证提交到源码仓库。
5. Windows 验证首次启动、文件夹选择、笔记保存与重启、购买链接、许可证激活/撤销、原官网数据访问及商店更新。
6. 提交认证后，以 Partner Center 的实际认证状态为准。

参考：
- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/choose-distribution-path
- https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-manual-conversion
- https://learn.microsoft.com/en-us/windows/apps/publish/store-policies#108-financial-transactions
