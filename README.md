# TinyNote App

一个基于 Tauri + React 的轻量级笔记应用，提供简洁优雅的笔记管理体验。

## ✨ 特性

- 🚀 **轻量快速**：基于 Tauri 构建，提供原生应用的性能体验
- 📁 **目录管理**：支持层级目录结构，便于组织笔记
- 🎯 **拖拽排序**：支持拖拽重新排序笔记和目录
- 💾 **本地存储**：数据存储在本地，保护隐私
- 🌙 **现代界面**：简洁美观的 UI 设计
- 📋 **剪贴板支持**：快速复制和粘贴内容
- 🔍 **快速搜索**：快速查找笔记内容

## 🛠️ 技术栈

- **前端框架**：React 18 + TypeScript
- **桌面框架**：Tauri 2
- **构建工具**：Vite
- **样式方案**：Tailwind CSS 4
- **状态管理**：Zustand
- **拖拽库**：@dnd-kit
- **图标库**：Lucide React

## 📦 安装

### 前置要求

- Node.js >= 18
- Rust >= 1.70
- 系统依赖（根据操作系统）：
  - **macOS**：无额外要求
  - **Linux**：需要安装 webkit2gtk
  - **Windows**：需要安装 WebView2

### 克隆仓库

```bash
git clone https://github.com/your-username/tinynote-app.git
cd tinynote-app
```

### 安装依赖

```bash
npm install
```

## 🚀 运行

### 开发模式

```bash
npm run tauri dev
```

### 构建应用

```bash
npm run tauri build
```

构建产物位于 `src-tauri/target/release/` 目录。

## 📖 使用指南

### 首次使用

1. 启动应用后，选择笔记存储位置
2. 创建新笔记或导入现有笔记
3. 使用目录面板管理笔记分类
4. 在笔记面板中编辑和查看笔记内容

### 主要功能

- **创建笔记**：点击工具栏的新建按钮
- **编辑笔记**：在右侧笔记面板中编辑
- **删除笔记**：右键点击笔记选择删除
- **重命名**：双击笔记目录进行重命名
- **搜索笔记**：使用顶部的搜索框
- **拖拽排序**：拖拽笔记或目录调整顺序

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 LICENSE 文件了解详情。

## 🙏 致谢

感谢以下开源项目：

- [Tauri](https://tauri.app/)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [dnd-kit](https://dndkit.com/)
- [Lucide Icons](https://lucide.dev/)

## 📮 联系方式

如有问题或建议，欢迎通过以下方式联系：

- 提交 [Issue](https://github.com/your-username/tinynote-app/issues)
- 发送邮件至：your-email@example.com

---

Made with ❤️ by [Your Name](https://github.com/your-username)
