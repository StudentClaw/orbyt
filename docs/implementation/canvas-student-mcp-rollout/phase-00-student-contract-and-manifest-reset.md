# Phase 00 - Student Contract And Manifest Reset

Last updated: 2026-04-17

## Orientation Note

- Target feature: reset the Canvas rollout around a student-role MCP surface and make the replacement contract explicit before implementation starts
- Key dependencies: [PLAN.md](../../../PLAN.md), [docs/features/INDEX.md](../../features/INDEX.md), [docs/features/02-canvas-integration.md](../../features/02-canvas-integration.md), [docs/architecture/05-external-services.md](../../architecture/05-external-services.md), current Canvas extension files under `packages/extensions/canvas-mcp/`
- Constraints and boundaries:
  - keep the existing Student Claw plugin, gateway, and vault architecture
  - treat this as a breaking contract reset for Canvas tools
  - do not update the feature spec in this phase
  - do not implement endpoint changes yet
- Acceptance criteria for this increment:
  - the new public student tool inventory is locked
  - the removal boundary for the legacy 6-tool surface is explicit
  - manifest and typed result-schema work is clearly defined
  - downstream phases can build against one stable contract target

## Beginning

### Objective

Define the new Canvas student-facing contract, manifest expectations, and schema plan so the rest of the rollout has a fixed target.

### Current State

- The current Canvas extension manifest exposes six tools centered on coursework, grades, announcements, and sync behavior.
- The current feature spec still describes that legacy surface and broader sync-oriented behavior.
- Discovery work shows the desired direction is a student-role tool inventory modeled after the reference repo, while preserving Student Claw's own runtime architecture.

### Out Of Scope

- Canvas client endpoint rewrites
- permission fallback implementation
- consumer migration
- local file download implementation

### Acceptance Criteria

- The rollout names the complete replacement student tool inventory.
- The legacy 6-tool surface is marked as removed rather than preserved as compatibility wrappers.
- Manifest updates needed for the new surface are called out clearly.
- Typed result-schema families are identified for self tools, shared read tools, student actions, and local downloads.
- Gateway and consumer teams have one stable list of future exposed tool names.

## Middle

### Implementation Slices

1. Freeze the replacement tool inventory and categorize it by:
   - self-scoped student tools
   - shared student read tools
   - student-side action tools
2. Define the manifest change plan:
   - remove the legacy 6 tools
   - add the new student-role tool list
   - keep the extension identity and transport model unchanged
3. Define the typed result-schema plan for:
   - upcoming assignments
   - submission status
   - course grades
   - todo and peer review todo
   - shared read resources
   - local download results
4. Define the breaking-change boundary for:
   - gateway inventory
   - Codex-facing tool names
   - any UI or server consumers that currently assume the old 6-tool surface
5. Record the assumptions that later phases must preserve:
   - student-only public surface
   - no compatibility bridge
   - no transport rewrite

### Primary Directories

- `packages/extensions/canvas-mcp/`
- `packages/contracts/src/schemas/`
- `packages/server/src/mcp/`
- `docs/implementation/canvas-student-mcp-rollout/`

### Verification Gates

- Unit:
  - future manifest tests can prove the new tool inventory exactly matches the phase contract
  - future schema tests can prove the new result families decode and reject malformed payloads
- Integration:
  - gateway inventory consumers can be enumerated against the new contract with no ambiguous tool naming
- Manual smoke:
  - one reviewer can read the phase doc and identify the full replacement surface without consulting multiple documents
- Failure path:
  - any omitted legacy tool or ambiguous replacement mapping is surfaced and resolved before implementation starts

### Evidence To Capture

- finalized student tool inventory list
- legacy-to-new surface replacement summary
- one manifest diff example once implementation begins

## End

### Done When

- the Canvas public student-facing MCP contract is decision-complete
- later phases no longer need to debate public tool names, manifest scope, or compatibility strategy

### Handoff To Next Phase

Phase 01 can now rework the Canvas client and self-scoped tools around one fixed student contract instead of the old sync-oriented surface.

### Risks To Carry Forward

- if manifest changes and schema changes drift apart, later phases will create gateway or test churn
- if the breaking-change boundary is softened later, consumer migration work will become ambiguous

### First Recommended Next Step

Start [Phase 01 - Student-Safe Client And Self Tools](phase-01-student-safe-client-and-self-tools.md).
