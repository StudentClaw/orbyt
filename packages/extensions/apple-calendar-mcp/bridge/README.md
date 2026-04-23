# Calendar API Bridge

Vendored Swift bridge for the Apple Calendar MCP package. This bridge is
colocated with the extension package in Phase 01 so later phases can give
Electron Main ownership of its build, lifecycle, permissions, and packaging.

## Vendored From

- Upstream Git URL: `https://github.com/shadowfax92/apple-calendar-mcp.git`
- Pinned commit: `e06ce970b42abff7151a62c793e263af3be57065`
- Original path: `swift-calendar-bridge/`

## Current Role

- Source is vendored for continuity and packaging planning.
- Orbyt does not yet manage this bridge lifecycle in Phase 01.
- Later rollout phases will move bridge startup, health checks, permission
  prompts, and packaged binary handling under Electron Main.
