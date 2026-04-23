# Phase 00 - Memorize Filesystem And State Contract (Spec)

Last updated: 2026-04-19

This is the authoritative filesystem and state contract that later phases build
on. It is the source of truth for Phase 00.

## 1. Scope

- Lock the on-disk layout under `~/.orbyt/memory/`.
- Lock filename conventions for daily, weekly, and graph files.
- Lock the mandatory section shape for graph nodes (base + course nodes).
- Lock the `memorize-state.json` payload contract.
- Draw a clean boundary between "lives in markdown" vs "lives in state json".

Out of scope: scheduler, summarization, promotion logic, UI readers.

## 2. Memory Root

The memory root resolves as follows:

1. If `ORBYT_HOME` is set, root is `${ORBYT_HOME}/memory`.
2. Otherwise, root is `~/.orbyt/memory`.

The env override exists for tests and dev isolation only. In production, the
hard-coded `~/.orbyt` home is expected.

## 3. Filesystem Layout

```
<memory-root>/
├── MEMORY.md                        # root index, links to scaffold branches
├── memorize-state.json              # operational checkpoint (NOT markdown)
├── daily/
│   └── YYYY-MM-DD.md                # rolling, keep newest 7
├── weekly/
│   └── YYYY-Www.md                  # rolling, keep newest 4 (ISO week)
└── graph/
    ├── school/
    │   ├── index.md                 # scaffold landing page
    │   ├── courses/
    │   │   └── <course-slug>/
    │   │       └── index.md         # one course node per directory
    │   └── playbooks/
    │       └── <playbook-slug>.md   # cross-course assignment playbooks
    ├── work/
    │   └── index.md
    ├── relationships/
    │   └── index.md
    ├── personality/
    │   └── index.md
    └── routine/
        └── index.md
```

### 3.1 Filename Rules

- Daily: `YYYY-MM-DD.md` in the student's local date. One file per day.
- Weekly: `YYYY-Www.md` using ISO-8601 week number (`W01`..`W53`). One per week.
- Course directory: kebab-case slug, e.g. `cs-301-data-structures/`.
- Playbook file: kebab-case slug, e.g. `problem-set-playbook.md`.
- No timestamp suffixes on graph files. Graph files are updated in place.

### 3.2 Directory Creation Policy

- Memorize ensures the full root tree exists on first run. Missing
  directories are created; existing ones are not touched.
- A scaffold landing page (`graph/<branch>/index.md`) is seeded on first run
  only if it is missing. Existing pages are never overwritten.

## 4. MEMORY.md Contract

- `MEMORY.md` is the root index. It links to exactly the five scaffold
  branches and to the most recent daily/weekly artifacts.
- It is **mostly static**. Memorize only writes inside two managed sections,
  identified by exact heading text:
  - `## Recent Daily` - regenerated each run from `daily/` (newest first, up
    to 7 entries)
  - `## Recent Weekly` - regenerated each run from `weekly/` (newest first,
    up to 4 entries)
- All other sections are operator-editable and must not be rewritten.
- Canonical seed template:

  ```md
  # Memory

  This is the root of the Memorize markdown graph.

  ## Scaffold

  - [School](graph/school/index.md)
  - [Work](graph/work/index.md)
  - [Relationships](graph/relationships/index.md)
  - [Personality](graph/personality/index.md)
  - [Routine](graph/routine/index.md)

  ## Recent Daily

  <!-- managed by memorize -->

  ## Recent Weekly

  <!-- managed by memorize -->
  ```

## 5. Graph Node Contract

### 5.1 Base Graph Node

Every file under `graph/**` (except operator notes) must contain these
mandatory H2 headings in this exact order and exact casing:

1. `## Purpose`
2. `## Linked Nodes`
3. `## Durable Facts`
4. `## Observed Patterns`
5. `## Evidence`

Rules:

- Headings are the machine-update contract. Memorize locates sections by H2
  heading text and rewrites only the body of the targeted section.
- Unknown H2 headings are preserved untouched between the managed ones.
- Empty sections keep their heading with an explicit `_none yet_` placeholder.

### 5.2 Course Node (`graph/school/courses/<slug>/index.md`)

A course node has additional mandatory H2 sections inserted between
`## Durable Facts` and `## Observed Patterns`:

1. `## Purpose`
2. `## Linked Nodes`
3. `## Durable Facts`
4. `## Canvas Layout`
5. `## Professor Patterns`
6. `## Assignment Strategy`
7. `## Recurring Pitfalls`
8. `## Current Improvements`
9. `## Observed Patterns`
10. `## Evidence`

### 5.3 Course Node Frontmatter

Course node `index.md` files must include YAML frontmatter with:

- `slug`: string, matches directory name (e.g. `cs-301-data-structures`)
- `canvasId`: number or null, the Canvas course id when known
- `canvasName`: string, original Canvas course name
- `courseCode`: string, e.g. `CS 301`
- `term`: string, e.g. `Spring 2026`
- `createdAt`: ISO-8601 string
- `updatedAt`: ISO-8601 string

This dual-identity model (Q3 resolved): the directory name is the
human-readable slug; the immutable Canvas id lives in frontmatter.

### 5.4 Playbook Node (`graph/school/playbooks/<slug>.md`)

Follows the base graph node contract (5.1). Intended for cross-course
strategies: problem sets, essays, labs, coding assignments.

## 6. Operational State (`memorize-state.json`)

### 6.1 Schema (v1)

```json
{
  "version": 1,
  "lastRunAt": "2026-04-19T07:00:00.000Z",
  "lastRunOutcome": "success",
  "lastProcessedThreadCursor": {
    "<threadId>": "2026-04-19T06:58:12.000Z"
  },
  "lastDailyFile": "2026-04-19",
  "lastWeeklyFile": "2026-W16",
  "pendingPromotionCandidates": []
}
```

Field meanings:

- `version`: integer, bumped on breaking shape changes. v1 today.
- `lastRunAt`: ISO-8601 UTC timestamp of the last completed run.
- `lastRunOutcome`: `"success" | "failed" | "partial"`.
- `lastProcessedThreadCursor`: map from thread id to the ISO-8601 timestamp
  of the last message the run consumed from that thread. This is the
  incremental cursor Phase 02 uses.
- `lastDailyFile`: basename (no extension) of the last daily file written.
- `lastWeeklyFile`: ISO week key of the last weekly file written.
- `pendingPromotionCandidates`: queue of promotion candidates that need a
  second evidence pass before Phase 03 commits them to the graph.

### 6.2 State vs Markdown Boundary

Lives in `memorize-state.json`:

- run timestamps and outcomes
- per-thread cursors
- pending promotion queue
- any retry/backoff counters

Lives in markdown:

- every fact, observation, pattern, and evidence line visible to the student
- links between nodes
- human-authored operator notes

Rule: if a reviewer wants to read it, it is markdown. If only the runtime
reads it, it is json state.

## 7. Examples

### 7.1 Sample Course Node

```md
---
slug: cs-301-data-structures
canvasId: 12345
canvasName: "CS 301 - Data Structures"
courseCode: "CS 301"
term: "Spring 2026"
createdAt: "2026-04-19T00:00:00.000Z"
updatedAt: "2026-04-19T00:00:00.000Z"
---

# CS 301 - Data Structures

## Purpose

Capture durable operating knowledge for CS 301 this term.

## Linked Nodes

- [School](../../index.md)
- [Problem Set Playbook](../../playbooks/problem-set-playbook.md)

## Durable Facts

_none yet_

## Canvas Layout

_none yet_

## Professor Patterns

_none yet_

## Assignment Strategy

_none yet_

## Recurring Pitfalls

_none yet_

## Current Improvements

_none yet_

## Observed Patterns

_none yet_

## Evidence

_none yet_
```

### 7.2 Sample Daily File (`daily/2026-04-19.md`)

```md
# Daily - 2026-04-19

## Notable Events

- shipped Phase 00 scaffold

## Assignment Observations

_none_

## Learning Signals

_none_

## Promotion Candidates

- candidate: "prefers markdown-first systems" (source: chat, confidence: 0.9)
```

### 7.3 Sample Weekly File (`weekly/2026-W16.md`)

```md
# Weekly - 2026-W16

## Recurring Struggles

_none_

## Recurring Wins

_none_

## Emerging Strategies

_none_

## Candidate Long-Term Lessons

_none_
```

## 8. Acceptance Criteria (Phase 00)

- [x] Memory root path resolution rule is fixed (env override + default).
- [x] Full filesystem tree is enumerated.
- [x] Daily / weekly filename formats are fixed.
- [x] MEMORY.md managed sections are named and bounded.
- [x] Base graph node H2 order is fixed and mandatory.
- [x] Course node extension H2 order is fixed and mandatory.
- [x] Course identity dual model is decided (slug dir + frontmatter id).
- [x] `memorize-state.json` shape is defined.
- [x] State-vs-markdown boundary is stated.

## 9. Open Items Pushed To Later Phases

- Phase 01: scheduler cadence, isolated-thread mechanics, catch-up behavior.
- Phase 02: chat ingestion cursoring, summary prompt design, pruning script.
- Phase 03: promotion rule set (repeated-evidence count, confidence floors).
- Phase 04: which server/UI surfaces read which memory files.
- Phase 05: recovery semantics on torn writes and schema version bumps.
