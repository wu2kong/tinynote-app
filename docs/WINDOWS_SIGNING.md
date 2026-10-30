# Windows Azure Artifact Signing

Azure Artifact Signing（旧名 Trusted Signing）托管 Windows Authenticode 证书和私钥。项目的 GitHub Release 工作流支持按需启用：Tauri 在打包过程中签署应用及安装包，随后上传 Release；现有 WinSparkle appcast 再对最终安装包生成更新签名。

## 先确认申请资格

截至 2026-09-08，Public Trust 支持美国、加拿大、欧盟、英国、澳大利亚、新西兰、日本、韩国、新加坡、瑞士、挪威及以色列的组织；个人开发者仅支持美国和加拿大。中国大陆个人或组织目前不在名单中。以微软最新要求为准，不能通过选择其他 Azure 服务器地区绕过身份资格。

Private Trust / Public Trust Test 不能替代面向普通用户分发所需的 Public Trust。该服务需要 Azure 订阅并计费；添加仓库配置不会自动开通服务或完成身份审核。

## Azure 设置

1. 在 Azure 创建 Artifact Signing account，完成真实主体的 identity validation，并创建 **Public Trust** certificate profile。
2. 在 Microsoft Entra 创建用于发布的 App Registration，记录 tenant ID、client ID，并创建 client secret。保存的是 secret **Value**，不是 secret ID；到期前需要轮换。
3. 在对应 certificate profile 的 IAM 中，为应用的服务主体授予 **Artifact Signing Certificate Profile Signer** 角色。
4. 记录账户所在地区的 endpoint、账户名称和 certificate profile 名称。

## GitHub 设置

进入仓库 Settings → Secrets and variables → Actions。

Repository secrets：

| 名称 | 内容 |
| --- | --- |
| `AZURE_TENANT_ID` | Entra tenant ID |
| `AZURE_CLIENT_ID` | App Registration client ID |
| `AZURE_CLIENT_SECRET` | Client secret Value |

Repository variables：

| 名称 | 内容 |
| --- | --- |
| `AZURE_ARTIFACT_SIGNING_ENDPOINT` | Azure 账户显示的 HTTPS endpoint，例如 `https://eus.codesigning.azure.net/` |
| `AZURE_ARTIFACT_SIGNING_ACCOUNT` | Artifact Signing account 名称 |
| `AZURE_ARTIFACT_SIGNING_CERTIFICATE_PROFILE` | Public Trust certificate profile 名称 |
| `AZURE_ARTIFACT_SIGNING_ENABLED` | 完成上述配置后设置为 `true` |

启用后，原有 Release 事件触发 Windows 构建时会安装固定版本 `artifact-signing-cli` 并通过 Tauri 的 `bundle.windows.signCommand` 接入签名。缺少配置或签名失败会使 Windows 构建失败，不会自动回退到未签名发布。未设置开关时，保留原有构建行为。

这里采用 Tauri 官方文档示例使用的 client secret 认证。密钥仅存储在 GitHub secrets，不要提交到仓库。生成的临时 Tauri 配置不包含认证密钥。首次真实发布需在 Windows 检查应用 EXE、NSIS 安装程序及 MSI 的数字签名、发布者和时间戳；例如使用 `Get-AuthenticodeSignature` 检查 `Status` 为 `Valid`。

此配置仅接入 `.github/workflows/release.yml`，本地 `build:packages` 和 Microsoft Store 工作流没有自动启用 Azure 签名。

## 仍需保留的签名

- macOS 的 Apple Developer ID 签名与公证需要 Apple 自己的证书和流程。
- Sparkle / WinSparkle 更新验证仍需要现有 `SPARKLE_PRIVATE_KEY`，Azure Authenticode 不替代它。
- 已签名的新文件仍可能触发 SmartScreen 信誉提示，不能承诺立即免提示。

参考：[微软设置指南](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart)、[微软 FAQ](https://learn.microsoft.com/en-us/azure/artifact-signing/faq)、[Tauri Windows 签名](https://v2.tauri.app/distribute/sign/windows/)、[签名 CLI](https://github.com/Levminer/artifact-signing-cli)。
