# Phase 00 - Source Ingestion And Rollout Scaffold

Last updated: 2026-04-18

## Orientation Note

- Target feature: establish the rollout package, shared vocabulary, and source-ingestion boundary for Apple Calendar as the first curated extension beyond Canvas
- Key dependencies: [PLAN.md](../../internal/PLAN.md), [docs/implementation/mcp-plugin-system/README.md](../mcp-plugin-system/README.md), the external source package at `~/Documents/calendar/apple-calendar-mcp`
- Constraints and boundaries:
  - do not implement runtime code in this phase
  - do not define remote download or marketplace behavior
  - lock the vendored-source model now so later phases do not reopen it
- Acceptance criteria for this increment:
  - the rollout docs package exists
  - Apple Calendar source inputs and target repo paths are explicit
  - out-of-scope boundaries are stated clearly
  - the vendored-extension decision is treated as fixed for this rollout

## Beginning

### Objective

Create a decision-stable documentation base for the curated extension rollout
before any code vendoring or runtime changes begin.

### Current State

- The existing plugin system rollout already defines discovery, lifecycle, gateway, auth, install-management, and packaged-runtime phases for Orbyt’s extension system.
- Apple Calendar currently exists outside this repo as a standalone MCP package with:
  - a TypeScript stdio MCP server
  - a Swift EventKit HTTP bridge
  - README and publishing notes
- Orbyt does not yet have a documented pattern for vendoring and owning a curated extension that depends on a local helper runtime.

### Out Of Scope

- remote package downloads
- third-party marketplace ingestion
- generic OAuth or remote-credential frameworks
- implementing Apple Calendar runtime code
- broad refactors to the predecessor plugin-system rollout

### Acceptance Criteria

- The new docs package exists at `docs/implementation/curated-extension-catalog-rollout/`.
- This phase locks the target vendoring path:
  - `packages/extensions/apple-calendar-mcp/`
- This phase locks the self-contained bridge path:
  - `packages/extensions/apple-calendar-mcp/bridge/`
- This phase names the canonical source inputs:
  - external TypeScript MCP server
  - external Swift bridge
  - external README and publishing notes
- The rollout states that Orbyt will maintain a monorepo-native extension package instead of shelling out to tarballs at runtime.

## Middle

### Implementation Slices

1. Create the rollout docs package and phase ordering.
2. Define glossary terms for curated extensions, bridge ownership, and runtime readiness.
3. Record the source-ingestion boundary for Apple Calendar:
   - what is copied in
   - where it lands in the repo
   - what stays external only as historical reference
4. State explicit non-goals so future phases do not drift into remote catalog work.

### Canonical Source Inputs

The canonical source for vendoring is the upstream `mcp-apple-calendars`
package. Implementation must pin a specific commit SHA at vendoring time and
record it in the vendored package's `README.md` under a `Vendored From`
heading. Machine-local paths are reference aids, not inputs.

Required record at vendoring time:

- upstream Git URL
- pinned commit SHA
- upstream license
- upstream author attribution

Paths inside the pinned upstream tree that are copied in:

- TypeScript MCP server: `src/`
- Swift bridge: `swift-calendar-bridge/`
- Package metadata: `package.json` (used only as a reference, not copied verbatim; see Phase 01 normalization rules)
- External usage and publishing guidance: `README.md`, `PUBLISHING.md` (used as reference; not copied verbatim)

If a machine-local checkout is used during the initial vendoring pass (for
example `~/Documents/calendar/apple-calendar-mcp`), the vendoring PR must still
record the upstream Git URL and SHA. Local paths alone are not an acceptable
source record.

### Target Repo Paths

- Vendored extension package:
  - `packages/extensions/apple-calendar-mcp/`
- Vendored bridge source:
  - `packages/extensions/apple-calendar-mcp/bridge/`
- Future runtime integration surfaces:
  - `packages/electron/src/plugins/`
  - `packages/electron/src/main.ts`
  - `packages/ui/src/components/settings/ConnectionsSection.tsx`

### Primary Directories

- `docs/implementation/curated-extension-catalog-rollout/`
- `docs/implementation/mcp-plugin-system/`
- `packages/extensions/`
- pinned upstream Apple Calendar source tree (Git URL + SHA recorded at vendoring time)

### Verification Gates

- Unit:
  - docs package completeness check
  - link and path sanity pass for all phase docs
- Integration:
  - none beyond source-ingestion review for this phase
- Manual smoke:
  - reviewer can identify the vendored target paths and canonical external source inputs without ambiguity
- Failure path:
  - if source ownership or target paths are still ambiguous after review, this phase stays open

### Evidence To Capture

- list of created rollout docs files
- one short source-to-target mapping summary
- confirmation that the vendored-extension decision is documented as fixed

## End

### Done When

- the curated-extension rollout package exists and is internally consistent
- Apple Calendar source ingestion is specified clearly enough that Phase 01 can start without reopening sourcing decisions

### Handoff To Next Phase

Phase 01 should turn the source-ingestion boundary into a concrete Orbyt
package shape for `packages/extensions/apple-calendar-mcp/`.

### Risks To Carry Forward

- if vendoring rules stay vague, later phases may accidentally mix source-of-truth ownership between Orbyt and the external package
- if this rollout silently expands into remote catalog work, the phased implementation will lose focus

### First Recommended Next Step

Start [Phase 01 - Apple Calendar Extension Vendoring](phase-01-apple-calendar-extension-vendoring.md).
