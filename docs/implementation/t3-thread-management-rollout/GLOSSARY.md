# T3 Thread Management Rollout Glossary, Tracker, And Handoff

Last updated: 2026-04-22

This file has two jobs:

1. Track where implementation currently stands for each phase.
2. Capture handoff notes so the next implementation step starts with real
   context instead of rediscovery.

## Status Legend

- `not_started`: no implementation work has begun
- `in_progress`: active implementation is underway
- `blocked`: implementation paused by a dependency or failure
- `complete`: acceptance criteria and verification gates are satisfied

## Verification State Legend

- `Not run`: the phase verification gate has not been exercised yet
- `In progress`: some verification work has started, but the full gate is not
  yet green
- `Failed`: at least one required verification check is currently failing
- `Verified`: the full verification gate is green for the current phase state

Verification state tracks the health of the evidence for a phase. Phase
`Status` tracks delivery progress. A phase should not be marked `complete`
unless its verification state is `Verified`.

## Phase Tracker

| Phase | Status | Owner | Verification State | Next Action |
| --- | --- | --- | --- | --- |
| 00 - Rollout Scaffold And State Audit | not_started | Codex | Not run | Start Phase 00 - Rollout Scaffold And State Audit |
| 01 - Thread Lifecycle Contracts And Command Surface | not_started | Codex | Not run | Wait for Phase 00 architecture note and scope lock |
| 02 - Durable Runtime Bindings And Session Recovery | not_started | Codex | Not run | Wait for Phase 01 command and contract surface |
| 03 - Thread Runtime Separation And Lazy Session Attachment | not_started | Codex | Not run | Wait for Phase 02 runtime-binding model |
| 04 - Delete Cleanup Reactors And Terminal Lifecycle | not_started | Codex | Not run | Wait for Phase 03 thread and runtime separation |
| 05 - UI, Snapshot, History, And Hardening | not_started | Codex | Not run | Wait for Phase 04 lifecycle cleanup contract |

## Current Recommended Next Step

Start [Phase 00 - Rollout Scaffold And State Audit](phase-00-rollout-scaffold-and-state-audit.md).

The repo already contains useful predecessor work under
[docs/implementation/thread-runtime-isolation/README.md](../thread-runtime-isolation/README.md).
That package proved queued and streaming semantics, isolated per-thread runtime
ownership, admission control, warm reuse, LRU eviction, and deterministic
shutdown behavior. This rollout picks up from that baseline and adds the missing
core lifecycle parity with `t3code`:

- archive and unarchive
- stronger runtime-binding persistence and resumability
- clean thread record versus runtime attachment separation
- delete cleanup that is explicit and future-safe
- renderer parity for the expanded lifecycle model

Full event-authoritative projections and rollback or revert support are deferred
until after this rollout.

## Handoff Update Protocol

When a phase changes state, append a new entry to the relevant phase section
below with:

- date
- branch
- owner
- what was completed
- what remains
- blockers or risks
- commands run
- evidence captured
- first recommended next step

### Handoff Entry Template

```md
- Date: YYYY-MM-DD
- Branch: feature/<name>
- Owner: <name>
- Status change: not_started -> in_progress | in_progress -> complete | etc.
- Completed:
  - item
  - item
- Remaining:
  - item
  - item
- Contract changes:
  - file + symbol
  - migration notes for consumers
  - `none` if this phase did not touch public contracts
- Risks or blockers:
  - item
  - item
- Commands run:
  - `bun run typecheck`
  - `bun test --cwd <package>`
- Evidence captured:
  - test output
  - screenshot
  - log snippet
- First recommended next step:
  - item
```

## Shared Vocabulary

### Thread Record

The durable chat thread object visible in history, routing, and snapshots. A
thread record exists independently from any current live provider session.

### Runtime Binding

The persisted provider-session attachment for a thread. It stores the metadata
needed to understand, stop, recover, or recreate the runtime side of a thread
without redefining the thread record itself.

### Live Runtime

The in-memory active or warm thread runtime owned by `ThreadRuntimeManager`.
This is the currently running process-level object, not the persisted binding.

### Archive

A reversible soft-close operation that preserves thread history while taking the
thread out of the normal active workflow. Archived threads are intentionally not
normal send targets.

### Unarchive

The inverse of archive. It restores an archived thread to normal active
visibility and commandability.

### Delete

Permanent removal of thread-visible data plus cleanup of queued work, runtime
ownership, and related session artifacts.

### Stop Session

Termination of only the provider or runtime attachment while preserving the
thread record and its history.

### Resume Cursor

A provider-owned resumability token stored in the runtime binding so a thread's
provider session can be recreated or resumed after the live runtime disappears.

### Lazy Session Attachment

The rule that a thread can be created without requiring an immediately live or
meaningful provider session. The runtime attachment is created or refreshed only
when needed.

### Cleanup Reactor

An asynchronous cleanup path triggered by a lifecycle event such as thread
delete. The cleanup reactor owns side effects that should not be buried
implicitly inside unrelated command handlers.

### Renderer Parity

The requirement that sidebar, chat, and history surfaces correctly reflect real
thread lifecycle state including archived, queued, streaming, interrupted, and
completed behavior.

### Core Lifecycle Parity

The scope locked for this rollout: archive and unarchive, durable resumable
runtime bindings, thread versus runtime separation, deterministic delete
cleanup, and renderer parity. It excludes full event-authoritative projections
and rollback or revert support.

### Event-Authoritative Projection Parity

The deferred future state where append-only lifecycle events become the source
of truth and thread-read tables are rebuilt as projections rather than edited
directly.

### Verification Gate

The set of checks that must be green before a phase can be marked complete:

- unit or contract coverage for the phase's core public behavior
- one integration check
- one manual smoke test
- one failure-path check

## Defaults Locked By This Rollout

- Rollout home is `docs/implementation/t3-thread-management-rollout/`.
- Existing thread-runtime isolation docs remain in place and are treated as
  predecessor context, not replaced by this rollout.
- This rollout targets `Core Lifecycle Parity`, not full
  `Event-Authoritative Projection Parity`.
- Full event-sourced thread projections and rollback or revert support are
  deferred until after Phase 05.
- `ThreadRuntimeManager` remains the runtime owner for active and warm runtime
  state.
- The glossary structure should stay close to other rollout glossaries so
  implementation tracking remains familiar across packages.
- Phase docs in this rollout must include explicit TDD sections:
  `Behavior Priority`, `Tracer Bullet`, `Incremental Red -> Green Slices`, and
  `Refactor Gate`.
- TDD work in this rollout must use public interfaces and vertical slices only.

## Phase Handoff Log

### Phase 00 - Rollout Scaffold And State Audit

No entries yet.

### Phase 01 - Thread Lifecycle Contracts And Command Surface

No entries yet.

### Phase 02 - Durable Runtime Bindings And Session Recovery

No entries yet.

### Phase 03 - Thread Runtime Separation And Lazy Session Attachment

No entries yet.

### Phase 04 - Delete Cleanup Reactors And Terminal Lifecycle

No entries yet.

### Phase 05 - UI, Snapshot, History, And Hardening

No entries yet.
