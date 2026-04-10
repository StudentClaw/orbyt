# Student Claw — Demo Guide

Student Claw is a local-first AI-powered desktop app that helps students manage study time, track assignments, and execute academic tasks through a chat-first experience.

## Prerequisites

| Tool | Version |
|------|---------|
| [Bun](https://bun.sh) | `1.3.5+` |
| Node.js | `24+` |

## Quick Start

### 1. Install dependencies

```bash
bun install
```

### 2. Start both server and UI (single command)

```bash
bun run dev:standalone
```

This starts:
- **Server** — `http://localhost:8787` (WebSocket + SQLite backend)
- **UI** — `http://localhost:5173` (React frontend)

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

### Alternative: Start services separately

In two separate terminals:

**Terminal 1 — Server:**
```bash
bun run dev:server
```

**Terminal 2 — UI:**
```bash
bun run dev:ui
```

---

## App Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — overview of tasks and study schedule |
| `/chat` | Chat — AI assistant for student tasks |
| `/activity` | Activity log |
| `/onboarding` | First-time setup flow |
| `/settings` | App settings |

---

## Environment Variables (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8787` | Server port |
| `DB_PATH` | `~/.student-claw/data.db` | SQLite database path |
| `NODE_ENV` | `development` | Environment mode |

Example:
```bash
PORT=9000 bun run dev:server
```

---

## Stopping the App

Press `Ctrl+C` in the terminal(s) to shut down gracefully.
