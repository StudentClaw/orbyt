# Contributing to Orbyt

Welcome! This guide walks you through development setup, running tests, and submitting pull requests.

## Prerequisites

- **Bun** `1.3.5` or compatible newer version (monorepo package manager)
- **Node.js** `24+` recommended
- **macOS** (V1 targets macOS only)

## Development Setup

### 1. Install dependencies

From the repository root:

```bash
bun install
```

This installs all workspace packages (`packages/*` and `packages/extensions/*`).

### 2. Environment variables

Copy `.env.example` to `.env` (or `.env.local`) at the repo root and fill in as needed:

```bash
cp .env.example .env
```

All variables are optional—Orbyt picks safe defaults when unset. See `.env.example` for descriptions of:
- **Codex** settings (AI runtime, model, timeout)
- **Local data** paths (SQLite database, home directory)
- **Dev convenience** flags (logging, devtools, standalone UI)

## Available Scripts

<!-- AUTO-GENERATED -->

| Command | Purpose | Workspace(s) |
|---------|---------|--------------|
| `bun run dev` | Start full dev environment (Electron app with patching) | All |
| `bun run dev:ui` | Start React dev server (Vite HMR) | ui |
| `bun run dev:server` | Start local Bun server with watch mode | server |
| `bun run dev:electron` | Start Electron dev environment | electron, ui |
| `bun run dev:standalone` | Start UI without Electron against remote server | ui |
| `bun run build` | Build all packages for distribution | All |
| `bun run build:shared` | Build shared dependencies (contracts, shared-runtime, shared) | shared, contracts, shared-runtime |
| `bun run build:extensions` | Build all MCP extensions | extensions/template-mcp, extensions/canvas-mcp, extensions/apple-calendar-mcp |
| `bun run build:apple-calendar-bridge` | Build Apple Calendar bridge (macOS arm64/x64) | Scripts |
| `bun run dist:electron:mac` | Create macOS `.dmg` distribution artifact | electron |
| `bun run dist:electron:mac:signed` | Create signed macOS `.dmg` for release | electron |
| `bun run typecheck` | Type-check all workspaces (TypeScript --noEmit) | All |
| `bun run lint` | Lint UI package (ESLint) | ui |
| `bun run test` | Run all test suites | All |
| `bun run test:contracts` | Test contracts package | contracts |
| `bun run test:shared-runtime` | Test shared-runtime package | shared-runtime |
| `bun run test:shared` | Test shared package | shared |
| `bun run test:server` | Test server package (max 1 concurrent) | server |
| `bun run test:ui` | Test UI package (Vitest) | ui |
| `bun run test:template-mcp` | Test template-mcp extension | extensions/template-mcp |
| `bun run test:canvas-mcp` | Test canvas-mcp extension | extensions/canvas-mcp |
| `bun run test:apple-calendar-mcp` | Test apple-calendar-mcp extension | extensions/apple-calendar-mcp |

<!-- END AUTO-GENERATED -->

## Monorepo Structure

```
packages/
├── ui/                    React frontend (Vite + Electron)
├── electron/              Electron desktop shell & IPC bridge
├── server/                Local Bun server (Canvas sync, memory, scheduling)
├── contracts/             Shared type definitions & schemas
├── shared/                Common utilities
├── shared-runtime/        Runtime utilities for Electron & server
└── extensions/            MCP (Model Context Protocol) extensions
    ├── template-mcp/      Example MCP template
    ├── canvas-mcp/        Canvas LMS integration
    └── apple-calendar-mcp/ Apple Calendar integration
```

## Testing

### Unit Tests

Run all test suites:

```bash
bun run test
```

Run tests for a specific workspace:

```bash
bun run test:server          # Server tests (max 1 concurrent)
bun run test:ui              # UI tests (Vitest)
bun run test:contracts       # Contracts tests
bun run test:shared          # Shared tests
bun run test:shared-runtime  # Shared-runtime tests
bun run test:template-mcp    # Extension tests
bun run test:canvas-mcp
bun run test:apple-calendar-mcp
```

### Watch Mode

For development, use Bun's watch mode:

```bash
# Watch server
bun --watch src/index.ts

# Or use the dev script
bun run dev:server
```

### Coverage Target

Aim for **80%+ test coverage** across all packages. Coverage is tracked per-package in CI.

## Code Quality

### Type Checking

Type-check all packages (without building):

```bash
bun run typecheck
```

TypeScript configuration per package:
- `packages/*/tsconfig.json` - Package-specific settings
- Shared runtime types in `packages/shared-runtime`

### Linting

Lint the UI package:

```bash
bun run lint
```

ESLint configuration: `packages/ui/.eslintrc.json`

## Building

### Development Builds

For development, use the dev scripts (they include watch mode and HMR):

```bash
# Rebuild shared dependencies when you modify contracts, shared-runtime, or shared:
bun run build:shared

# Then rebuild dependent packages:
bun --cwd packages/server build
bun --cwd packages/ui build
```

### Production Builds

Build all packages for release:

```bash
bun run build
```

This builds:
1. Shared packages (contracts, shared-runtime, shared)
2. Application packages (server, ui, electron)
3. Extensions (template-mcp, canvas-mcp, apple-calendar-mcp)
4. Stages bundled extensions and skills

### macOS Distribution

Create a signed `.dmg` for release:

```bash
bun run dist:electron:mac:signed
```

Or unsigned:

```bash
bun run dist:electron:mac
```

## shadcn/ui Setup

To apply the selected shadcn UI preset to the UI workspace:

```bash
bunx --bun shadcn@latest init -c packages/ui --preset b3RXNlzf8 --template vite
```

## Pull Request Workflow

### Before submitting a PR:

1. **Type-check locally:**
   ```bash
   bun run typecheck
   ```

2. **Run tests locally:**
   ```bash
   bun run test
   ```

3. **Lint (UI only):**
   ```bash
   bun run lint
   ```

4. **Build to verify:**
   ```bash
   bun run build:shared
   bun --cwd packages/server build
   bun --cwd packages/ui build
   bun --cwd packages/electron build
   ```

5. **PR checklist:**
   - [ ] Tests pass (`bun run test`)
   - [ ] Types check (`bun run typecheck`)
   - [ ] UI lints (`bun run lint`)
   - [ ] No console errors in dev tools
   - [ ] Affected packages have updated `package.json` versions (if applicable)
   - [ ] Commit messages follow [conventional commits](https://www.conventionalcommits.org/)

## Documentation

Orbyt documentation is organized in:

- **`DESIGN.md`** - Design language and interaction principles
- **`docs/architecture/`** - System architecture docs
- **`docs/features/`** - Feature specifications
- **`docs/checklist/`** - Release and feature checklists
- **`docs/implementation/`** - Implementation guides
- **`docs/internal/`** - Internal planning, TDD process, notes (not shipped)

For package-specific docs:
- **`packages/*/README.md`** - Package documentation
- **`packages/*/src/`** - Inline JSDoc comments

## Key Packages

### `@orbyt/contracts`
Type definitions, schemas, and contracts for all packages.
- Uses Effect Schema for validation
- Types for IPC, RPC, and data models

### `@orbyt/server`
Local Bun server (Canvas sync, planner, memory, WebSocket routing).
- Entry: `src/index.ts`
- Service layer: `src/orchestration/`, `src/canvas/`, `src/ai/`

### `@orbyt/ui`
React + Vite frontend rendered inside Electron.
- Vite config: `vite.config.ts`
- Entry: `src/main.tsx`
- shadcn preset: `b3RXNlzf8`

### `@orbyt/electron`
Electron desktop shell, IPC bridge, local notifications, proactive scheduler.
- Main: `src/main/main.ts`
- Preload: `src/preload/index.ts`
- IPC handlers: `src/ipc/`

### Extensions (MCP)
Model Context Protocol integrations for Canvas, Apple Calendar, and templates.
- Use Bun test runner
- Each has `build` and `test` scripts

## Troubleshooting

### Build fails

1. Ensure `bun install` completed successfully
2. Rebuild shared: `bun run build:shared`
3. Check Node version: `node --version` (should be 24+)
4. Clear build artifacts: `rm -rf packages/*/dist packages/*/.tsbuildinfo`

### Tests fail

1. Check test isolation—ensure mocks are reset between tests
2. Verify dependencies are installed: `bun install`
3. Run with increased verbosity: `bun test --verbose`
4. Check SQLite database path in env: `echo $DB_PATH`

### Electron dev crashes

1. Check devtools is disabled unless needed: `ORBYT_DEBUG_WINDOW=0 bun run dev`
2. Verify Codex binary is on PATH or set `CODEX_BINARY_PATH`
3. Clear Electron cache: `rm -rf ~/.config/Orbyt`

### UI server won't connect

1. Ensure server is running: `bun run dev:server`
2. Check WebSocket URL in `.env`: `VITE_STANDALONE_WS_URL`
3. Verify no port conflicts (default: 8080 for server)

## Questions?

Check the documentation:
- Architecture: `docs/architecture/`
- Feature specs: `docs/features/`
- Internal notes: `docs/internal/`

Or open an issue on GitHub.

Happy coding!
