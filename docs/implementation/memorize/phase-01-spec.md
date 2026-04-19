# Phase 01 - Memorize Scheduler And Run Checkpointing (Spec)

Last updated: 2026-04-19

This is the authoritative scheduler and checkpoint contract that later phases
depend on. It is the source of truth for Phase 01.

## 1. Scope

- Lock the twice-daily cadence and local-time interpretation.
- Lock the ownership boundary between Electron (scheduling) and server (turn body).
- Lock catch-up semantics for missed runs and partial failures.
- Lock checkpoint write semantics (when it is written, when it is not).
- Ship runnable code: `MemorizeScheduler`, `MemorizeStateStore`,
  `MemorizeTurnRunner` interface with a no-op stub.

Out of scope: summarization prompts, graph writes, IPC activation wiring
(heartbeats system connects the scheduler to runtime later).

## 2. Cadence

Memorize runs twice per local calendar day:

- **Morning slot**: 07:00 local time
- **Evening slot**: 20:00 local time

Local time is resolved from the system timezone via JavaScript's `Date` API.
Timezone preference settings are deferred to a later phase.

Run constants live in `@student-claw/contracts`:
- `MORNING_RUN_HOUR = 7`
- `EVENING_RUN_HOUR = 20`

## 3. Ownership Split

```
Electron
  └── MemorizeScheduler
        ├── owns: next-run computation, timer scheduling, catch-up detection
        ├── calls: getLastRunAt() → Date | null (injected from heartbeats activation)
        └── calls: onRun() → Promise<void>  (injected from heartbeats activation)

Server
  └── MemorizeTurnRunner.run()
        ├── owns: isolated turn execution, daily/weekly/graph writes (Phases 02/03)
        └── calls: MemorizeStateStore.commitSuccess() | .recordFailure()
```

Electron does not know what the run does. Server does not own the timer.
The heartbeats system connects these two when it wires activation.

## 4. Next-Run Computation

Given `now: Date`, the next scheduled run is:

1. If `now < 07:00 local` → same day 07:00
2. If `07:00 ≤ now < 20:00` → same day 20:00
3. If `now ≥ 20:00` → next day 07:00

Slots are boundaries (≤ now means the slot has passed; > now means it is upcoming).

## 5. Catch-Up Semantics

On every app launch, `runCatchUpIfNeeded()` is called before the scheduler
starts. It:

1. Computes the most-recently-passed slot relative to `now`.
2. Reads `lastRunAt` from the state.
3. If `lastRunAt` is null or predates the most recent slot → triggers one
   consolidated catch-up run.
4. Does **not** backfill per-missed-slot — one run ingests everything since
   the last checkpoint.

The most-recently-passed slot:

1. If `now ≥ 07:00 same day` → the latest slot that has occurred today.
2. If `now < 07:00 same day` → yesterday 20:00.

## 6. Checkpoint Contract

File: `~/.student-claw/memory/memorize-state.json` (see phase-00-spec.md §6)

### When the checkpoint IS written

- After a successful run commits its daily/weekly/graph outputs, `commitSuccess()`
  writes a new state with `lastRunOutcome: "success"` and all updated cursor
  fields.
- On failure, `recordFailure()` updates only `lastRunOutcome: "failed"` and
  preserves all prior cursor fields.

### When the checkpoint IS NOT written

- During a run in progress. No partial checkpoint is written mid-turn.
- If the process is killed before `commitSuccess()` completes. The last
  successful checkpoint is preserved.
- On schema decode error. The bad file is left intact; the read returns the
  initial state and an error is surfaced.

### Atomic write contract

1. Encode the new state.
2. Write to `<memory-root>/.memorize-state.tmp.json`.
3. `rename()` tmp → `memorize-state.json` (atomic on POSIX).
4. No temp file remains after a successful write.

## 7. Idempotency

A repeated run over the same input window (same cursor values, same `now`) must
not create duplicate daily, weekly, or graph changes. Phase 02 enforces this by
only appending to a daily file if the cursor advanced since the last write.
Phase 01's responsibility is to preserve the cursor so Phase 02 can detect
no-op runs.

## 8. Code Locations

| Artifact | Location |
|---|---|
| `MemorizeScheduler` class | `packages/electron/src/memorize/memorize-scheduler.ts` |
| `computeNextMemorizeRun` | same file, exported |
| `computeMostRecentPassedSlot` | same file, exported |
| `memorizeRunNeeded` | same file, exported |
| `MemorizeStateStore` class | `packages/server/src/memory/state-store.ts` |
| `MemorizeTurnRunner` interface | `packages/server/src/memory/runner.ts` |
| `NoOpMemorizeTurnRunner` | same file |
| `MemorizeRunResult`, `MemorizeRunError` | `packages/contracts/src/schemas/memorize.ts` |
| Scheduler tests (15) | `packages/electron/src/__tests__/memorize-scheduler.test.ts` |
| State store tests (7) | `packages/server/src/__tests__/memorize-state-store.test.ts` |

## 9. Note For Phase 02

`NoOpMemorizeTurnRunner` is the Phase 01 stub. Phase 02 must replace it with a
real `MemorizeTurnRunner` implementation that:
- Reads conversation activity since `sinceCursor`
- Writes or updates the daily file
- Triggers weekly distillation if the week boundary has passed
- Returns a populated `MemorizeRunResult`

The no-op writes `lastRunAt` and sets `lastRunOutcome: "success"` so tests can
exercise the full scheduler → store cycle before Phase 02 is ready.

## 10. Acceptance Criteria (Phase 01)

- [x] Cadence fixed at 07:00 / 20:00 local time.
- [x] Next-run computation is correct for all time-of-day positions.
- [x] Catch-up is one consolidated run (not per-slot backfill).
- [x] Checkpoint only written on success; failure preserves last checkpoint.
- [x] Atomic write via temp file + rename.
- [x] Ownership split documented: Electron schedules, server executes.
- [x] `MemorizeTurnRunner` seam defined so Phase 02 can plug in without
      touching the scheduler or store.
- [x] 22 tests passing across scheduler and state store.

## 11. Open Items Pushed To Later Phases

- Phase 02: real turn body, daily/weekly file writes, cursor advancement.
- Phase 04: IPC wiring, heartbeats activation, `onRun` implementation.
- Future: timezone preference override from student settings.
