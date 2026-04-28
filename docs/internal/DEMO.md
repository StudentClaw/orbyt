# Orbyt — Demo Guide

Orbyt is a local-first AI-powered desktop app that helps students manage study time, track assignments, and execute academic tasks through a chat-first experience.

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

`dev:standalone` now generates a shared ephemeral WebSocket auth token and injects the matching bootstrap into the browser UI automatically.

---

### Alternative: Start services separately

In two separate terminals, generate one token first and reuse it in both:

```bash
export WS_AUTH_TOKEN=$(openssl rand -hex 32)
```

**Terminal 1 — Server:**
```bash
bun run dev:server
```

**Terminal 2 — UI:**
```bash
VITE_STANDALONE_WS_URL=ws://127.0.0.1:8787 \
VITE_STANDALONE_WS_AUTH_TOKEN=$WS_AUTH_TOKEN \
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
| `DB_PATH` | `~/.orbyt/data.db` | SQLite database path |
| `NODE_ENV` | `development` | Environment mode |

Example:
```bash
PORT=9000 bun run dev:server
```

---

## Stopping the App

Press `Ctrl+C` in the terminal(s) to shut down gracefully.
