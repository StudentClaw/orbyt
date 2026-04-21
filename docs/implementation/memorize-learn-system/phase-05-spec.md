# Phase 05 - Hardening, Verification, And Recovery (Spec)

Last updated: 2026-04-19

## 1. Scope

- Add concurrency lock: skip run if active chat turn is `streaming` or a prior Memorize run is in progress.
- Add idempotent recovery: if today's daily file already exists on entry, skip distillation and commit success using the existing file.
- Add stale course node marking: after a successful run, compare graph course dirs to active DB courses and write `_stale: true` + `_staleAt` to any node no longer enrolled.
- Add structured error logging: all caught errors append a JSON line to `memorize-error.log`.
- Write integration tests that wire the full stack against a real SQLite DB.
- Write a manual smoke-test checklist.

Out of scope: Codex process isolation (deferred), memory read endpoints for UI (not needed), weekly candidate graph-level text dedup (fingerprint dedup is sufficient).

## 2. Concurrency Lock

`MemorizeService.runIfNeeded` guards runs with two checks in order:

1. **In-flight lock** — module-level `isRunning: boolean` flag prevents overlapping runs in the same process lifetime.
2. **Streaming check** — queries `orchestration_turns WHERE status = 'streaming'`; if any row exists, logs to error log and returns `{ ran: false, result: null }`.

Neither check throws. Both are best-effort gates that log and bail.

## 3. Recovery Path

At the start of `LiveMemorizeTurnRunner.run`, before querying turns or calling the distiller:

```
if existsSync(paths.dailyFile(dateKey)):
    dailyContent = readDailyFile(paths, dateKey)
    dailyFileWritten = dateKey
    // skip distillation, proceed to retention + promotion + commitSuccess
```

This handles the failure window between a successful `writeDailyFile` and a failed `commitSuccess`. On the next run the daily file exists, so distillation is skipped and the checkpoint is written. The daily file content is left unchanged.

## 4. Stale Course Node Marking

`markStaleCourseNodes(paths, db, now): string[]`

1. Returns `[]` if `paths.coursesDir` does not exist.
2. Queries `SELECT code FROM courses` to get the active set.
3. Normalizes each code to a slug: lowercase, spaces → dashes, strip non-alphanumeric.
4. Reads `readdirSync(paths.coursesDir)` and for each directory not in the active slug set:
   - Skips if `index.md` is absent or has no frontmatter (`---` prefix).
   - Writes `_stale: true` and `_staleAt: <now ISO>` into the YAML frontmatter (update in place if key already exists, append otherwise).
5. Returns paths of all files written.

Called in `MemorizeService.runIfNeeded` after a successful run, wrapped in a try/catch that logs to error log on failure.

## 5. Error Log

`appendMemorizeError(paths, context, err): void`

Appends one JSON line to `paths.errorLog` (`memorize-error.log` in the memory root):

```json
{"timestamp":"2026-04-19T07:00:01.234Z","context":"live-runner.run","message":"...","stack":"..."}
```

- `mkdirSync` for the directory on every call (no-op if exists).
- Best-effort: never throws; errors during log write are silently ignored.

## 6. Integration Tests (`memorize-integration.test.ts`)

Uses a real `BunDatabase` bootstrapped via `runMigrations`. Seeds `orchestration_turns` and `courses` via raw `db.execute`. Tests:

1. Writes daily file when completed turns exist.
2. Daily file contains distiller output.
3. Advances `_global` cursor to latest turn's `completed_at`.
4. Does not write daily file when no turns exist.
5. Injects active courses into the prompt (`## Active Courses` section).
6. Cursor prevents re-processing already-seen turns on subsequent run (distiller not called on second run).

## 7. Recovery Tests (`memorize-recovery.test.ts`)

Uses a mock DB (empty query results) and a pre-written daily file to exercise the recovery path:

1. Skips distillation when daily file already exists for today.
2. Reports `dailyFileWritten` correctly in recovery mode.
3. Commits success and leaves existing file intact.
4. Writes error log when distillation throws.

## 8. Node Curator Tests (`memorize-node-curator.test.ts`)

Unit tests for `markStaleCourseNodes`:

1. Returns `[]` when courses dir does not exist.
2. Returns `[]` when all course nodes match active courses.
3. Marks node stale when course is not in active list.
4. Adds `_stale: true` to frontmatter.
5. Adds `_staleAt` to frontmatter.
6. Updates existing `_stale` field rather than appending a duplicate.
7. Skips node that has no frontmatter.
8. Normalizes course code to slug for comparison (spaces → dashes).
9. Returns multiple stale paths when multiple nodes are inactive.
10. Does not mark a node stale if its dir has no `index.md`.

## 9. Manual Smoke-Test Checklist

These checks confirm the full pipeline on a real device after deployment:

- [ ] App starts; server logs no Memorize errors at boot.
- [ ] Wait for or simulate 07:00 slot; `memorize-state.json` `lastRunAt` updates within 60s.
- [ ] `~/.student-claw/memory/daily/YYYY-MM-DD.md` exists and contains at least one bullet from recent turns.
- [ ] `memorize-state.json` `lastProcessedThreadCursor._global` is non-null and newer than before the run.
- [ ] Trigger a second run manually via `ws://127.0.0.1:{port}` `memorize.run` RPC while the first file exists; confirm file is unchanged and distiller is NOT called (recovery path).
- [ ] Add a course in Canvas settings; trigger a run; confirm `## Active Courses` section in the next daily file contains the course code.
- [ ] Remove a course from the DB directly; trigger `markStaleCourseNodes`; confirm `_stale: true` appears in the course node's `index.md`.
- [ ] Force a distiller error (e.g., bad API key); confirm `memorize-error.log` exists and contains a JSON line with `context: "live-runner.run"`.
- [ ] Start an active chat turn (set `status = 'streaming'` in DB manually); trigger `memorize.run` via RPC; confirm run is deferred and `memorize-error.log` contains `"Deferred"`.

## 10. Verification Gate

All three test files pass with 0 failures:

```
bun test src/__tests__/memorize-*.test.ts
```

Expected: 104 pass / 0 fail (20 new tests added in Phase 05 on top of 84 from Phase 04).
