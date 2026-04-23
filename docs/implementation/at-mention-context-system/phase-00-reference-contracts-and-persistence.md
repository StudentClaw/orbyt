# Phase 00 - Reference Contracts And Persistence

Last updated: 2026-04-23

## Orientation Note

- Target feature: let a turn carry a `references` array end-to-end in data, with schema, migration, persistence, and snapshot assembly all in place
- Key dependencies: [packages/contracts/src/protocol/orchestration.ts](../../../packages/contracts/src/protocol/orchestration.ts), [packages/server/src/orchestration/OrchestrationDB.ts](../../../packages/server/src/orchestration/OrchestrationDB.ts), [packages/server/src/orchestration/OrchestrationServiceLive.ts](../../../packages/server/src/orchestration/OrchestrationServiceLive.ts), existing `orchestration_turn_attachments` migration pattern
- Constraints and boundaries:
  - do not change any UI code yet
  - do not modify prompt serialization yet
  - do not extend `TurnAttachmentKind`; add a sibling type instead
  - do not add Canvas-specific resolver logic; references carry only stable pointers
- Acceptance criteria for this increment:
  - `TurnReferenceInput` and `OrchestrationTurnReference` exist in shared contracts
  - `sendTurn` accepts and persists references; snapshots read them back
  - zero-reference turns continue to work unchanged
  - automated coverage proves schema validation, migration, and round-trip

## Beginning

### Objective

Establish the data spine that every downstream phase will reuse. Prove that a turn can be authored with references, stored in SQLite, and returned in a snapshot without any UI or prompt text changes.

### Current State

- `TurnAttachmentInput` is path-centric and used both for DB persistence and UI rendering. It cannot represent an `@assignment` cleanly because references have no filesystem path.
- `OrchestrationServiceLive.sendTurn` currently accepts `(commandId, threadId, content, attachments, model)`. It needs a fifth input.
- Attachments are persisted to `orchestration_turn_attachments` via `persistTurnAttachments`; there is no parallel table for references yet.

### Out Of Scope

- prompt serialization changes (Phase 01)
- IPC channel additions (Phase 02)
- composer or picker UI (Phases 03 to 05)
- skill editor changes (Phase 06)

### Acceptance Criteria

- `TurnReferenceKind = "canvas-assignment"` literal union exists in contracts and is extensible without migration.
- `TurnReferenceInput` has `kind`, `id`, `label`, `url` and validates round-trip.
- A migration creates `orchestration_turn_references` with columns mirroring the attachments table (id, turn_id, kind, reference_id, label, url, position).
- `persistTurnReferences` and `readTurnReferencesByTurnIds` mirror the attachment helpers.
- `OrchestrationService.sendTurn` signature widens to accept `references: readonly TurnReferenceInput[]`.
- `OrchestrationTurn` snapshots include a `references` array.

## Middle

### Implementation Slices

1. Add schema types in [packages/contracts/src/protocol/orchestration.ts](../../../packages/contracts/src/protocol/orchestration.ts).
2. Add migration `packages/server/src/db/migrations/0XX-orchestration-turn-references.ts`.
3. Add DB helpers in [packages/server/src/orchestration/OrchestrationDB.ts](../../../packages/server/src/orchestration/OrchestrationDB.ts).
4. Widen service surface in [packages/server/src/orchestration/OrchestrationService.ts](../../../packages/server/src/orchestration/OrchestrationService.ts) and [packages/server/src/orchestration/OrchestrationServiceLive.ts](../../../packages/server/src/orchestration/OrchestrationServiceLive.ts).
5. Update `mapTurnRow` and all snapshot assembly sites to include `references`.

### Primary Directories

- `packages/contracts/src/protocol/`
- `packages/server/src/db/migrations/`
- `packages/server/src/orchestration/`

### TDD Cycle

Execute the red/green pairs in order. Do not write a later test before the previous implementation is green. Refactor only after the entire cycle is green.

1. RED: a contract test decodes a canonical `TurnReferenceInput` (`kind: "canvas-assignment"`, `id`, `label`, `url`) and asserts equality.
   GREEN: add `TurnReferenceKind` and `TurnReferenceInput` schema.
2. RED: the schema rejects an unknown `kind` with a typed decode error.
   GREEN: narrow `TurnReferenceKind` to a literal union.
3. RED: a migration test opens a temp DB, runs migrations up to the new one, and queries `PRAGMA table_info(orchestration_turn_references)` to confirm columns and indexes.
   GREEN: write the migration.
4. RED: a DB test persists one reference via `persistTurnReferences` and reads it back via `readTurnReferencesByTurnIds` for a known turn id.
   GREEN: implement the two helpers.
5. RED: a service test calls `sendTurn(..., references: [oneRef])` and asserts the returned turn snapshot contains a matching `OrchestrationTurnReference` with a generated id.
   GREEN: thread references through `sendTurn`, `mapTurnRow`, and the snapshot assembly path.
6. RED: an existing service test that calls `sendTurn` with no references still passes unchanged.
   GREEN: confirm default of `[]` is honored; no code change expected.
7. Refactor: extract shared row-mapping and ordering helpers between attachments and references if duplication exceeds a small threshold; otherwise leave alone.

### Verification Gates

- Unit:
  - schema accepts a valid `TurnReferenceInput` and rejects an invalid `kind`
  - `persistTurnReferences` + `readTurnReferencesByTurnIds` round-trip
- Integration:
  - `OrchestrationService.sendTurn` with one reference produces a snapshot containing it
- Manual smoke:
  - none required at this phase (no user-facing changes)
- Failure path:
  - sending a malformed reference payload produces a typed decode error without crashing the service

### Evidence To Capture

- passing test names covering the TDD cycle above
- a sample valid `TurnReferenceInput` JSON
- the migration filename and column list
- diff lines where `sendTurn` signature widens

## End

### Done When

- contract and DB work is merged behind no feature flag
- all new tests are green and no existing orchestration tests regress
- `references` survives the full `sendTurn -> persist -> snapshot` path

### Handoff To Next Phase

Phase 01 can start as soon as snapshots carry `references`. Phase 02 and Phase 03 can also begin in parallel since both only depend on the contract, not the persistence path.

### Risks To Carry Forward

- if `TurnReferenceKind` is modeled as a non-union string, future kinds will fail to type-narrow and Phase 03 parsing will regress
- if the migration table shape drifts from the attachments table, UI components that render both will need more conditional branches later

### First Recommended Next Step

Start [Phase 01 - Prompt And Display Serialization](phase-01-prompt-and-display-serialization.md).
