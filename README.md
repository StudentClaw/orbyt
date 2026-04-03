# Student Claw

Student Claw is a local-first desktop application that brings agentic AI workflows to everyday student tasks.
It helps students plan study time, track assignments, and improve academic outcomes through a chat-first experience.

## Repository Status

This repository is initialized with a monorepo scaffold and baseline packages for:

- `packages/ui` - React + Vite frontend
- `packages/server` - local server runtime
- `packages/electron` - desktop shell placeholder
- `packages/shared` - shared types/contracts
- `packages/extensions/template-mcp` - MCP extension template

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

- `PRODUCT_SENSE.md` - mission and product principles
- `DESIGN.md` - design language and interaction principles
- `TEST.md` - TDD workflow and test logging expectations
- `PLAN.md` - feature implementation lifecycle and delivery process
- `docs/features` - feature specs
- `docs/architecture` - system architecture docs

