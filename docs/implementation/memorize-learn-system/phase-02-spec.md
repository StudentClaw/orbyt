# Phase 02 - Daily And Weekly Distillation Pipeline (Spec)

Last updated: 2026-04-19

## 1. Scope

- Define the incremental read window for each Memorize run.
- Lock daily and weekly file structure and update semantics.
- Lock rolling retention with the fold-into-weekly expiry model.
- Implement the real `LiveMemorizeTurnRunner` replacing `NoOpMemorizeTurnRunner`.

Out of scope: graph node promotion (Phase 03), UI consumers (Phase 04).

## 2. Read Window

On each run, Memorize queries:

```sql
SELECT id, thread_id, input_text, output_text, completed_at
FROM orchestration_turns
WHERE status = 'completed'
  AND completed_at IS NOT NULL
  AND completed_at > :globalCursor   -- omitted on first run
ORDER BY completed_at ASC
```

The global cursor is stored in `lastProcessedThreadCursor` under the special
key `"_global"`. It is the latest `completed_at` across all turns processed in
the previous run. On first run (no cursor), all completed turns are returned.
Phase 04 may upgrade to per-thread cursors; the `_global` approach is v1.

After the run, the cursor advances to the latest `completed_at` in the new
batch. If no turns are found, the cursor is unchanged.

## 3. Daily File

### 3.1 Location

`~/.orbyt/memory/daily/YYYY-MM-DD.md`

### 3.2 Structure

Each run appends a run-stamped block:

```md
# Daily - 2026-04-19

## Run 07:00

### Notable Events

- ...

### Assignment Observations

- ...

### Learning Signals

- ...

### Promotion Candidates

- candidate: "..." (source: conversation, confidence: 0.9)

---

## Run 20:00

### Notable Events

...
```

Rules:
- If the file does not exist, create it with the heading and first run block.
- If the file exists, append `\n---\n\n## Run HH:MM\n\n{aiOutput}`.
- The AI output must contain only the four subsection bodies (no wrapping
  heading or date). The run block provides the heading.
- A second run on the same day adds a second `## Run` block. The cursor
  ensures only new turns appear in the second run's input.

### 3.3 AI Prompt

Template: `packages/server/src/memory/prompts/daily-distillation.md`

Placeholders: `{{date}}`, `{{thread_turns}}`

The prompt asks for exactly four subsections: Notable Events, Assignment
Observations, Learning Signals, Promotion Candidates.

## 4. Weekly File

### 4.1 Location

`~/.orbyt/memory/weekly/YYYY-Www.md`

### 4.2 Accumulation Model

Weekly files are **not written in one shot at week end**. They accumulate
incrementally as daily files expire:

1. When a daily file is the 8th file (oldest of 8), it expires.
2. Memorize distills the expiring daily into the weekly file for the expiring
   day's ISO week (the week the day belongs to, not the current week).
3. The expiring daily is deleted only after the weekly write succeeds.
4. The weekly file grows from 1 to 7 entries as consecutive days in a week
   expire over the following week.

This means: `2026-04-12` (W15) folds into `2026-W15.md`, even if today is
W16.

### 4.3 Structure

```md
# Weekly - 2026-W15

## Recurring Struggles

- ...

## Recurring Wins

- ...

## Emerging Study Strategies

- ...

## Candidate Long-Term Lessons

- lesson: "..." (confidence: 0.9)
```

### 4.4 AI Prompt

Template: `packages/server/src/memory/prompts/weekly-distillation.md`

Placeholders: `{{daily_date}}`, `{{daily_content}}`, `{{week_key}}`,
`{{weekly_content}}`

The prompt asks the AI to merge the expiring daily into the existing weekly,
extracting patterns and recurring signals. If no weekly file exists yet for
that week, an empty template with `_none_` placeholders is passed as
`{{weekly_content}}`.

## 5. Rolling Retention

### 5.1 Daily

- Keep newest 7 files. `DAILY_RETENTION = 7` from contracts.
- On each run, after writing today's daily: list all daily files sorted
  ascending. While count > 7, take the oldest, fold it into its weekly, delete
  it.
- Deletion happens only after the weekly write succeeds.

### 5.2 Weekly

- Keep newest 4 files. `WEEKLY_RETENTION = 4` from contracts.
- After daily pruning completes: list all weekly files sorted ascending.
  While count > 4, delete the oldest.
- Weekly files beyond 4 are deleted without distillation (they are already
  rolled-up summaries whose lifecycle is complete).

### 5.3 Prune-Only-After-Commit Rule

Pruning (`rmSync`) only runs as part of a successful `enforceRetention` call
inside `LiveMemorizeTurnRunner.run()`. If the runner throws before
`commitSuccess()`, any files already pruned in that run are gone, but the
checkpoint stays at its last-successful position — so the next run will not
re-attempt the same expired daily (it's already gone).

## 6. Distillation Transport

Interface: `MemorizeDistiller` (`packages/server/src/memory/distiller.ts`)

```ts
interface MemorizeDistiller {
  distill(prompt: string): Promise<string>
}
```

Real implementation: `CodexMemorizeDistiller` — wraps the existing
`CodexCliService.streamTurn()`. Reuses the same Codex thread ID across the
full run (all distillation calls within one Memorize run share a Codex
session); fresh turn IDs per call.

Tests inject a mock `MemorizeDistiller` — no real Codex calls in the test
suite.

## 7. Code Locations

| Artifact | Location |
|---|---|
| `LiveMemorizeTurnRunner` | `packages/server/src/memory/live-runner.ts` |
| `MemorizeDistiller` interface | `packages/server/src/memory/distiller.ts` |
| `CodexMemorizeDistiller` | same file |
| `readTurnsSince`, `buildCursor`, `formatTurnsForPrompt` | `packages/server/src/memory/turn-reader.ts` |
| `writeDailyFile`, `readDailyFile` | `packages/server/src/memory/daily-writer.ts` |
| `foldDailyIntoWeekly` | `packages/server/src/memory/weekly-writer.ts` |
| `enforceRetention`, `listDailyKeys`, `listWeeklyKeys` | `packages/server/src/memory/pruner.ts` |
| `isoWeekKey`, `isoDateKey`, `runLabel`, `parseIsoDate` | `packages/server/src/memory/week.ts` |
| `fillTemplate`, prompt constants | `packages/server/src/memory/prompts/index.ts` |
| Prompt markdown sources | `packages/server/src/memory/prompts/*.md` |
| Tests (25) | `packages/server/src/__tests__/memorize-*.test.ts` |

## 8. Note For Phase 03

Daily files write `### Promotion Candidates` blocks following the format:
```
- candidate: "<fact>" (source: conversation, confidence: <float>)
```

Weekly files write `## Candidate Long-Term Lessons` blocks following:
```
- lesson: "<lesson>" (confidence: <float>)
```

Phase 03 reads these from both daily and weekly files to decide what to
promote into the permanent graph.

## 9. Acceptance Criteria (Phase 02)

- [x] Read window: completed turns since `_global` cursor.
- [x] Daily files: run-stamped blocks, no duplication on second same-day run.
- [x] Weekly files: accumulate incrementally from expiring dailies.
- [x] Expiring daily folds into its own ISO week's weekly file.
- [x] Retention: 7 daily, 4 weekly — enforced after each successful run.
- [x] Prune-after-commit: no deletions on runner failure.
- [x] Distiller seam: `MemorizeDistiller` interface + `CodexMemorizeDistiller`.
- [x] 25 tests passing (week utils, daily writer, pruner, live runner).

## 10. Open Items Pushed To Later Phases

- Phase 03: parse promotion candidates and candidate lessons; promote into graph.
- Phase 04: wire `CodexMemorizeDistiller` with live `CodexCliService`; IPC activation.
- Future: upgrade `_global` cursor to per-thread cursors.
