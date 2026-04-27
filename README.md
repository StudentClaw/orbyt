# Orbyt

Orbyt is a local-first desktop application that brings agentic AI workflows to everyday student tasks.
It helps students plan study time, track assignments, and improve academic outcomes through a chat-first experience.

## Repository Status

Monorepo packages shipped in V1 (macOS desktop):

- `packages/ui` - React + Vite frontend rendered inside Electron
- `packages/electron` - desktop shell, IPC bridge, and local notifications
- `packages/server` - local Bun server (Canvas sync, planner, memory)
- `packages/contracts` - schemas and IPC/RPC types
- `packages/shared`, `packages/shared-runtime` - shared utilities
- `packages/extensions/{template-mcp,canvas-mcp,apple-calendar-mcp}` - bundled MCP extensions

V1 ships macOS-only as a signed `.dmg`. The previous PWA + cross-device push relay
have been removed; notifications are delivered locally through `Notification` from
Electron. The proactive weekly-insight scheduler is preserved in
`packages/electron/src/push/`.

## Prerequisites

- Bun `1.3.5` (or compatible newer version)
- Node.js `24+` recommended

## Install

From repo root:

```bash
bun install
```

## Run

From repo root:

- Start server:

```bash
bun run dev:server
```

- Start UI:

```bash
bun run dev:ui
```

- Typecheck all workspaces:

```bash
bun run typecheck
```

- Lint UI:

```bash
bun run lint
```

## UI Preset Setup (shadcn)

To apply the selected shadcn preset for the UI workspace:

```bash
bunx --bun shadcn@latest init -c packages/ui --preset b3RXNlzf8 --template vite
```

If authorization is required, sign in to shadcn and rerun the command.

## Product and Process Docs

- `DESIGN.md` - design language and interaction principles
- `docs/features` - feature specs
- `docs/architecture` - system architecture docs
- `docs/internal/` - internal planning, TDD process, demo notes (not shipped)
- `experiments/` - research and reference codebases (not built or shipped)

