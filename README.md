<p align="center">
  <img src="src-tauri/icons/icon.png" width="128" height="128" alt="Axon Logo">
</p>

<h1 align="center">Axon</h1>

<p align="center">
  <strong>A modern, native SSH & SFTP client for engineers who demand speed and elegance.</strong>
</p>

<p align="center">
  <a href="./README_CN.md">简体中文</a> ·
  <a href="#features">Features</a> ·
  <a href="#installation">Install</a> ·
  <a href="#development">Dev Guide</a> ·
  <a href="#architecture">Architecture</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-v2-blue?logo=tauri&logoColor=white" alt="Tauri v2">
  <img src="https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/Rust-2021-orange?logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

---

## Why Axon?

Most terminal emulators are either powerful but ugly, or beautiful but shallow. Axon is both — a full-featured SSH/SFTP workstation wrapped in a premium, keyboard-driven interface. Built with Rust for the backend and React for the frontend, it delivers native performance with zero Electron overhead.

## Features

### 🖥️ Terminal
- **Multi-pane sessions** — Split horizontally or vertically, work across servers simultaneously
- **Broadcast mode** — Send a single command to all open panes at once
- **GPU-accelerated rendering** — Smooth 60fps via xterm.js WebGL
- **Configurable cursors** — Block, underline, or bar with custom font/size
- **Auto-reconnect** — Automatically restores SSH sessions after network drops
- **Scrollback buffer** — Configurable history up to 100,000 lines

### 📂 SFTP File Manager
- **Dual-pane browser** — Navigate local and remote filesystems side by side
- **Drag & drop transfers** — Upload and download files with visual progress
- **Transfer queue** — Batch operations with real-time status tracking

### 🔒 Security
- **End-to-end encryption** — All sensitive data protected with XChaCha20-Poly1305
- **Key derivation** — Argon2id password hashing (16MB memory, 2 iterations)
- **Flexible storage** — Choose between local encrypted file or OS Keychain (macOS Keychain / Windows Credential Manager)
- **No telemetry** — Zero data collection, everything stays on your machine

### ☁️ Cloud Sync
- **GitHub Gist backup** — Encrypted host configurations synced via private Gists
- **Device Flow auth** — Secure OAuth without exposing client secrets
- **Push / Pull** — Manual sync control, you decide when data leaves your machine

### 📊 Server Monitoring
- **Live metrics** — Real-time CPU, memory, disk, and network stats
- **Session info** — Connection details, uptime, and protocol information
- **Shell history** — Import and browse remote command history

### 🎨 Interface
- **Dark & Light themes** — Carefully tuned palettes for day and night
- **i18n** — Full English and Chinese localization
- **Global search** — `Cmd+K` command palette for hosts, snippets, and files
- **Snippet manager** — Save, organize, and quickly execute common commands

## Installation

> Axon is in active development. Pre-built binaries will be available in the [Releases](https://github.com/aicmd/axon-term/releases) section soon.

### System Requirements

| Platform | Minimum |
|----------|---------|
| macOS    | 11.0 (Big Sur) |
| Windows  | 10 (1803+) |
| Linux    | WebKit2GTK 4.1 |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 9+
- [Rust](https://rustup.rs/) 1.75+
- Platform dependencies ([Tauri prerequisites](https://v2.tauri.app/start/prerequisites/))

### Setup

```bash
# Clone
git clone https://github.com/aicmd/axon-term.git
cd axon-term

# Install frontend dependencies
pnpm install

# Run in development mode (starts both Vite dev server and Tauri)
pnpm tauri dev

# Build production binary
pnpm tauri build
```

### Project Structure

```
axon-term/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   ├── terminal/       # Terminal pane, toolbar, broadcast
│   │   ├── sftp/           # SFTP file browser
│   │   ├── layout/         # App shell, sidebar, navigation
│   │   └── common/         # Shared UI primitives
│   ├── *Context.tsx        # React contexts (Host, Settings, Theme, I18n, Snippet)
│   ├── i18n.ts             # Internationalization dictionary
│   └── App.tsx             # Root application component
├── src-tauri/              # Rust backend
│   └── src/
│       ├── application/    # Service layer (SSH, SFTP, GitHub, Terminal)
│       ├── infrastructure/ # Low-level adapters (PTY, SSH, Crypto, Keyring)
│       ├── commands/       # Tauri IPC command handlers
│       ├── domain/         # Core data models
│       └── main.rs         # Application entry point
├── package.json
├── vite.config.ts
└── tauri.conf.json
```

## Architecture

```
┌─────────────────────────────────────────────┐
│              React Frontend                 │
│  ┌─────────┐ ┌──────┐ ┌──────┐ ┌────────┐  │
│  │Terminal  │ │ SFTP │ │Hosts │ │Settings│  │
│  │(xterm.js)│ │      │ │      │ │        │  │
│  └────┬─────┘ └──┬───┘ └──┬───┘ └───┬────┘  │
│       │          │        │         │        │
│       └──────────┴────────┴─────────┘        │
│                    │ Tauri IPC                │
├────────────────────┼─────────────────────────┤
│              Rust Backend                    │
│  ┌─────────────────┼───────────────────────┐ │
│  │           Command Layer                 │ │
│  ├─────────────────┼───────────────────────┤ │
│  │          Application Services           │ │
│  │  ┌──────┐ ┌─────┐ ┌──────┐ ┌────────┐  │ │
│  │  │ SSH  │ │SFTP │ │GitHub│ │Terminal│  │ │
│  │  └──┬───┘ └──┬──┘ └──┬───┘ └───┬────┘  │ │
│  ├─────┼────────┼───────┼─────────┼────────┤ │
│  │          Infrastructure                 │ │
│  │  ┌──────┐ ┌─────┐ ┌───────┐ ┌───────┐  │ │
│  │  │ PTY  │ │SSH2 │ │Crypto │ │Keyring│  │ │
│  │  └──────┘ └─────┘ └───────┘ └───────┘  │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## Tech Stack

| Layer      | Technology |
|------------|------------|
| Framework  | Tauri v2 |
| Frontend   | React 19, TypeScript, Tailwind CSS v4 |
| Backend    | Rust 2021 Edition |
| Terminal   | xterm.js 6 (WebGL) |
| SSH/SFTP   | libssh2 (via `ssh2` crate) |
| Local PTY  | `portable-pty` |
| Encryption | XChaCha20-Poly1305 + Argon2id |
| Keystore   | OS Keychain / encrypted local file |
| Icons      | Lucide React |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE) © yoke
