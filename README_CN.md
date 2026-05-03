<p align="center">
  <img src="src-tauri/icons/icon.png" width="128" height="128" alt="Axon Logo">
</p>

<h1 align="center">Axon</h1>

<p align="center">
  <strong>为追求速度与优雅的工程师打造的现代原生 SSH & SFTP 客户端。</strong>
</p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="#功能特性">功能特性</a> ·
  <a href="#安装">安装</a> ·
  <a href="#开发指南">开发指南</a> ·
  <a href="#架构设计">架构设计</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-v2-blue?logo=tauri&logoColor=white" alt="Tauri v2">
  <img src="https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/Rust-2021-orange?logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

---

## 为什么选择 Axon？

市面上的终端工具，要么功能强大但界面粗糙，要么界面精美但能力薄弱。Axon 两者兼具 —— 一个功能完整的 SSH/SFTP 工作站，包裹在一个高质感的键盘驱动界面之中。后端使用 Rust 构建，前端采用 React，提供原生级性能，零 Electron 开销。

## 功能特性

### 🖥️ 终端
- **多窗格会话** — 水平或垂直分屏，同时操作多台服务器
- **广播模式** — 一条命令同时发送到所有打开的窗格
- **GPU 加速渲染** — 基于 xterm.js WebGL 的 60fps 流畅体验
- **光标自定义** — 方块、下划线或竖线，支持自定义字体与大小
- **自动重连** — 网络断开后自动恢复 SSH 会话
- **滚动缓冲** — 可配置最高 100,000 行的历史记录

### 📂 SFTP 文件管理器
- **双栏浏览器** — 本地与远程文件系统并排浏览
- **拖拽传输** — 拖放文件即可上传下载，带可视化进度条
- **传输队列** — 批量操作，实时状态跟踪

### 🔒 安全
- **端到端加密** — 所有敏感数据使用 XChaCha20-Poly1305 保护
- **密钥派生** — Argon2id 密码哈希（16MB 内存，2 次迭代）
- **灵活存储** — 可选择本地加密文件或系统钥匙串（macOS Keychain / Windows 凭据管理器）
- **零遥测** — 不收集任何数据，一切留在你的机器上

### ☁️ 云同步
- **GitHub Gist 备份** — 加密的主机配置通过私有 Gist 同步
- **Device Flow 认证** — 安全的 OAuth 流程，无需暴露 client secret
- **手动推拉** — 你决定数据何时离开你的设备

### 📊 服务器监控
- **实时指标** — CPU、内存、磁盘、网络的实时统计
- **会话详情** — 连接信息、运行时间、协议类型
- **Shell 历史** — 导入并浏览远程主机的命令历史

### 🎨 界面
- **深色 / 浅色主题** — 为日间和夜间精心调校的配色方案
- **国际化** — 完整的中英文界面支持
- **全局搜索** — `Cmd+K` 命令面板，快速检索主机、命令片段与文件
- **命令片段管理器** — 保存、分类并快速执行常用命令

## 安装

> Axon 正处于积极开发阶段。预构建的安装包将很快在 [Releases](https://github.com/user/axon-term/releases) 页面提供。

### 系统要求

| 平台    | 最低要求 |
|---------|---------|
| macOS   | 11.0 (Big Sur) |
| Windows | 10 (1803+) |
| Linux   | WebKit2GTK 4.1 |

## 开发指南

### 前置条件

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 9+
- [Rust](https://rustup.rs/) 1.75+
- 平台依赖（[Tauri 前置条件](https://v2.tauri.app/start/prerequisites/)）

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/user/axon-term.git
cd axon-term

# 安装前端依赖
pnpm install

# 以开发模式运行（同时启动 Vite 和 Tauri）
pnpm tauri dev

# 构建生产版本
pnpm tauri build
```

### 项目结构

```
axon-term/
├── src/                    # React 前端
│   ├── components/         # UI 组件
│   │   ├── terminal/       # 终端窗格、工具栏、广播
│   │   ├── sftp/           # SFTP 文件浏览器
│   │   ├── layout/         # 应用外壳、侧边栏、导航
│   │   └── common/         # 共享 UI 基础组件
│   ├── *Context.tsx        # React 上下文 (Host, Settings, Theme, I18n, Snippet)
│   ├── i18n.ts             # 国际化词典
│   └── App.tsx             # 根组件
├── src-tauri/              # Rust 后端
│   └── src/
│       ├── application/    # 服务层 (SSH, SFTP, GitHub, Terminal)
│       ├── infrastructure/ # 底层适配器 (PTY, SSH, Crypto, Keyring)
│       ├── commands/       # Tauri IPC 命令处理器
│       ├── domain/         # 核心数据模型
│       └── main.rs         # 应用入口
├── package.json
├── vite.config.ts
└── tauri.conf.json
```

## 架构设计

```
┌─────────────────────────────────────────────┐
│              React 前端                      │
│  ┌─────────┐ ┌──────┐ ┌──────┐ ┌────────┐  │
│  │  终端   │ │ SFTP │ │ 主机 │ │  设置  │  │
│  │(xterm.js)│ │      │ │      │ │        │  │
│  └────┬─────┘ └──┬───┘ └──┬───┘ └───┬────┘  │
│       │          │        │         │        │
│       └──────────┴────────┴─────────┘        │
│                    │ Tauri IPC                │
├────────────────────┼─────────────────────────┤
│              Rust 后端                       │
│  ┌─────────────────┼───────────────────────┐ │
│  │           命令层 (Commands)              │ │
│  ├─────────────────┼───────────────────────┤ │
│  │           应用服务层 (Services)           │ │
│  │  ┌──────┐ ┌─────┐ ┌──────┐ ┌────────┐  │ │
│  │  │ SSH  │ │SFTP │ │GitHub│ │  终端  │  │ │
│  │  └──┬───┘ └──┬──┘ └──┬───┘ └───┬────┘  │ │
│  ├─────┼────────┼───────┼─────────┼────────┤ │
│  │           基础设施层 (Infra)              │ │
│  │  ┌──────┐ ┌─────┐ ┌───────┐ ┌───────┐  │ │
│  │  │ PTY  │ │SSH2 │ │ 加密  │ │钥匙串 │  │ │
│  │  └──────┘ └─────┘ └───────┘ └───────┘  │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## 技术栈

| 层级     | 技术 |
|----------|------|
| 框架     | Tauri v2 |
| 前端     | React 19, TypeScript, Tailwind CSS v4 |
| 后端     | Rust 2021 Edition |
| 终端     | xterm.js 6 (WebGL) |
| SSH/SFTP | libssh2 (通过 `ssh2` crate) |
| 本地 PTY | `portable-pty` |
| 加密     | XChaCha20-Poly1305 + Argon2id |
| 密钥存储 | 系统钥匙串 / 本地加密文件 |
| 图标     | Lucide React |

## 参与贡献

请参阅 [CONTRIBUTING.md](CONTRIBUTING.md) 了解贡献指南。

## 开源许可

[MIT](LICENSE) © yoke
