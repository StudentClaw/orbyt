# Apple Calendar MCP

Bundled Orbyt extension for reading and editing local macOS calendars
through the existing Electron-managed MCP plugin runtime.

## Phase 01 Scope

This package is the vendored Phase 01 canary for the curated extension catalog
rollout. It establishes the bundled extension package shape and preserves the
upstream Apple Calendar tool names. Bridge lifecycle, readiness, permissions,
and packaging hardening land in later phases of
`docs/implementation/curated-extension-catalog-rollout/`.

## Tool Surface

- `getCalendars`
- `getCalendarEvents`
- `createCalendar`
- `createCalendarEvent`
- `updateCalendarEvent`
- `deleteCalendarEvent`
- `deleteCalendar`

## Vendored From

- Upstream Git URL: `https://github.com/shadowfax92/apple-calendar-mcp.git`
- Pinned commit: `e06ce970b42abff7151a62c793e263af3be57065`
- Upstream package name: `mcp-apple-calendars`
- Upstream license: `MIT`
- Attribution: original Apple Calendar MCP and Swift bridge by Shadowfax

## Notes

- The vendored MCP package keeps the upstream camelCase tool names unchanged.
- The manifest stays local-only with `transport.type = "local_stdio"`.
- Runtime bridge env is intentionally not hard-coded in the manifest. Later
  phases inject bridge connection details at spawn time.
