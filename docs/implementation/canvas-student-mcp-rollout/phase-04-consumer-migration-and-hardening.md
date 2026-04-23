# Phase 04 - Consumer Migration And Hardening

Last updated: 2026-04-17

## Orientation Note

- Target feature: migrate Orbyt consumers off the legacy Canvas surface, harden the new student contract, and finish rollout verification
- Key dependencies: Phases 00 through 03, current gateway inventory behavior, current Canvas consumers in server and UI code, [docs/features/02-canvas-integration.md](../../features/02-canvas-integration.md)
- Constraints and boundaries:
  - remove the legacy 6-tool surface instead of preserving compatibility wrappers
  - keep the feature spec update limited to behavior that has actually landed
  - finish verification before marking the rollout complete
  - do not introduce educator or sync-oriented scope creep
- Acceptance criteria for this increment:
  - consumers are migrated to the new student surface
  - gateway inventory reflects only the replacement Canvas contract
  - failure-path behavior is hardened across the tool families
  - rollout docs and handoff materials are complete

## Beginning

### Objective

Replace all remaining assumptions about the old Canvas student surface, then harden and verify the new one as the stable baseline.

### Current State

- Earlier phases define the replacement contract, client strategy, shared reads, and action/download behavior.
- Existing Orbyt consumers may still assume the old six-tool Canvas inventory and the older coursework-centric mental model.
- The current feature spec still documents the old surface and should only be updated when the implementation starts landing.

### Out Of Scope

- educator or admin tools
- background sync redesign beyond what is needed to remove old consumer assumptions
- feature expansion beyond the agreed student surface

### Acceptance Criteria

- The old Canvas tool names are removed from gateway and consumer expectations.
- New consumer mappings are explicit for any UI, orchestration, or prompt surfaces that reference Canvas tools.
- Failure handling is consistent for auth failures, permission denials, hidden resources, and local file-write errors.
- Implementation docs, tracker state, and handoff notes are ready for execution and follow-on maintenance.

## Middle

### Implementation Slices

1. Identify and migrate all consumers that assume:
   - the old Canvas tool names
   - the old coursework or sync abstractions
   - old success or error message shapes
2. Define gateway and inventory hardening work:
   - inventory reflects only the new student surface
   - discovery and routing tests use the new tool names
   - hidden educator tools do not leak into Codex-facing inventory
3. Define cross-cutting hardening work for:
   - auth failures
   - per-course permission denials
   - hidden or unavailable content
   - local download path and write failures
4. Define documentation update work once behavior lands:
   - update `docs/features/02-canvas-integration.md`
   - update any implementation notes or checklists touched by the rollout
   - append glossary handoff entries as each phase changes state
5. Define final verification and acceptance evidence needed to close the rollout.

### Primary Directories

- `packages/extensions/canvas-mcp/`
- `packages/server/src/mcp/`
- `packages/server/src/ai/`
- `packages/ui/src/`
- `docs/implementation/canvas-student-mcp-rollout/`
- `docs/features/02-canvas-integration.md`

### Verification Gates

- Unit:
  - future inventory, schema, and consumer tests cover only the replacement student surface
  - future hardening tests cover typed auth, permission, and local-write failures
- Integration:
  - full routed Canvas tool path works end to end using the new student tool inventory
- Manual smoke:
  - one student session can use the new Canvas surface without any reference to the removed legacy tools
- Failure path:
  - one auth failure, one permission denial, and one local file-write failure all surface recoverable, non-ambiguous outcomes

### Evidence To Capture

- gateway inventory snapshot after migration
- one end-to-end student flow using the new tools
- one auth failure example
- one permission-denied example
- one local download failure example

## End

### Done When

- Orbyt no longer depends on the old Canvas student MCP surface
- the new student-role contract is verified, documented, and ready for follow-on implementation work

### Handoff To Next Phase

The end of this rollout becomes the beginning context for the first implementation branch that lands the new Canvas student surface. Use [GLOSSARY.md](GLOSSARY.md) as the tracker and append handoff evidence as work progresses.

### Risks To Carry Forward

- if any consumer silently retains old tool-name assumptions, the rollout will appear partially complete while still breaking routed behavior
- if docs are not updated when behavior lands, future planning will split between the old feature spec and the new rollout package

### First Recommended Next Step

Begin implementation from [Phase 00 - Student Contract And Manifest Reset](phase-00-student-contract-and-manifest-reset.md) and record the first handoff entry in [GLOSSARY.md](GLOSSARY.md).
