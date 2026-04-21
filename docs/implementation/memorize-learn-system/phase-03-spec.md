# Phase 03 - Graph Promotion And Node Evolution (Spec)

Last updated: 2026-04-19

## 1. Scope

- Define how promotion candidates are parsed from daily and weekly distillation output.
- Lock promotion thresholds and cross-layer evidence accumulation.
- Define graph node seeding, section routing, and deterministic append behavior.
- Wire the full promotion pipeline into `LiveMemorizeTurnRunner`.

Out of scope: UI reads of graph nodes (Phase 04), node retirement or stale-marking (Phase 05).

## 2. Candidate Parsing

Each Memorize run reads promotion candidates from two sources:

**Daily files** — parsed using `parseDailyCandidates()`. Expected format in the
`### Promotion Candidates` section of a daily distillation:

```
- candidate: "<the fact>" (source: conversation, confidence: <0.0-1.0>, branch: <branch>)
```

**Weekly files** — parsed using `parseWeeklyCandidates()`. Expected format in
the `## Candidate Long-Term Lessons` section of a weekly distillation:

```
- lesson: "<the lesson>" (confidence: <0.0-1.0>, branch: <branch>)
```

Both parsers produce `ParsedCandidate` objects with `{ id, fingerprint, source,
branch, text, confidence }`. The fingerprint is a 16-character SHA-256 hex
prefix of `text.trim().toLowerCase()`.

### Branch Format

`branch` is a slash-delimited path string:

| Branch | Target file |
| --- | --- |
| `school/courses/<slug>` | `graph/school/courses/<slug>/index.md` |
| `school/playbooks/<slug>` | `graph/school/playbooks/<slug>.md` |
| `school` | `graph/school/index.md` |
| `personality` | `graph/personality/index.md` |
| `routine` | `graph/routine/index.md` |
| `work` | `graph/work/index.md` |
| `relationships` | `graph/relationships/index.md` |

## 3. Promotion Thresholds

A candidate is promoted when EITHER condition is met:

| Condition | Threshold |
| --- | --- |
| Immediate (high confidence) | `confidence >= 0.9` |
| Accumulated evidence | `evidenceCount >= 2` |

Cross-layer counting: daily and weekly candidates with the same fingerprint
(same normalized text) share an `evidenceCount` in `pendingPromotionCandidates`.
A daily candidate seen once plus a weekly lesson with the same text counts as
`evidenceCount = 2` and triggers promotion on the second run.

## 4. Deduplication

Once a candidate is promoted, its fingerprint is added to
`promotedCandidateFingerprints` in `memorize-state.json`. Any future candidate
with that fingerprint is silently skipped — it is neither queued nor promoted
again. This prevents the same fact from accumulating duplicate bullets in the
graph.

## 5. Graph Node Structure

### Non-course nodes (scaffold branches: school, personality, routine, work, relationships)

Seeded from a base template with these H2 sections (in order):
`## Purpose`, `## Linked Nodes`, `## Durable Facts`, `## Observed Patterns`, `## Evidence`

All promoted facts append to `## Durable Facts`.

### Course nodes (`school/courses/<slug>`)

Seeded with YAML frontmatter:

```yaml
---
slug: <slug>
canvasId: null
canvasName: "<slug>"
courseCode: "<SLUG>"
term: ""
createdAt: "<iso>"
updatedAt: "<iso>"
---
```

Section routing by keyword match (checked in order):

| Pattern | Section |
| --- | --- |
| canvas, module, assignment tab, pages tab, announcement, navigation | `## Canvas Layout` |
| professor, prof, instructor, dr., grader, rubric, submission format, late polic | `## Professor Patterns` |
| pitfall, mistake, avoid, don't, beware, warning | `## Recurring Pitfalls` |
| assignment, homework, problem set, lab, essay, project, quiz, exam strateg | `## Assignment Strategy` |
| (none matched) | `## Durable Facts` |

### Playbook nodes (`school/playbooks/<slug>`)

Seeded from the same base template as non-course nodes. Facts append to
`## Durable Facts`.

## 6. Append Semantics

`appendBulletToSection` guarantees:

1. The target H2 section is located by exact line match.
2. Existing bullets are preserved in order; `_none yet_` placeholder is removed.
3. The new bullet is appended at the end of the section.
4. If the section does not exist, it is created at the end of the file.
5. The file is written atomically via `writeFileSync` (single syscall; not
   temp+rename since partial graph nodes are recoverable).

Bullet format:
```
- <text> _(promoted YYYY-MM-DD)_
```

## 7. Run Sequence

Within `LiveMemorizeTurnRunner.run()`:

1. Read turns → distill daily content → write daily file (unchanged from Phase 02).
2. Run `enforceRetention` → fold expiring dailies into their ISO week's weekly file.
3. Collect the content of any weekly files written in step 2.
4. Call `runPromotion(paths, state, dailyContent, weeklyContent, now)`:
   - Parse candidates from both sources.
   - Merge into `pendingPromotionCandidates` queue, skipping already-promoted fingerprints.
   - For each candidate that meets a promotion threshold: call `writeGraphCandidate`, collect the returned file path, record the fingerprint.
5. Commit state: `pendingPromotionCandidates = updatedPending`, `promotedCandidateFingerprints = updatedFingerprints`.
6. Return `graphNodesUpdated = promotion.promoted` in `MemorizeRunResult`.

## 8. Acceptance Criteria

- [x] `parseDailyCandidates` and `parseWeeklyCandidates` parse all required fields including `branch`
- [x] Fingerprint deduplication prevents re-promotion across runs
- [x] Candidates below threshold accumulate evidence in `pendingPromotionCandidates`
- [x] High-confidence candidates (>= 0.9) are promoted immediately on first appearance
- [x] Second appearance of same-text candidate crosses threshold and is promoted
- [x] Weekly lessons count as evidence for the same-text daily candidate
- [x] Graph files are created at the correct path for each branch type
- [x] New nodes are seeded from the correct template (course vs base)
- [x] Course nodes include YAML frontmatter with kebab-case slug
- [x] Section routing directs facts to the correct H2 heading
- [x] `LiveMemorizeTurnRunner` returns `graphNodesUpdated` with promoted file paths
- [x] 39 Phase 03 tests pass across candidate-parser, graph-writer, and promoter

## 9. Files Modified Or Created

| File | Change |
| --- | --- |
| `packages/contracts/src/schemas/memorize.ts` | Added `branch` to `PromotionCandidate`; added `promotedCandidateFingerprints` to `MemorizeState` |
| `packages/server/src/memory/candidate-parser.ts` | NEW — parses daily and weekly distillation output |
| `packages/server/src/memory/graph-writer.ts` | NEW — seeds and appends to graph node files |
| `packages/server/src/memory/promoter.ts` | NEW — orchestrates full promotion pipeline |
| `packages/server/src/memory/live-runner.ts` | Wired `runPromotion`; now captures daily content and weekly content from folded files |
| `packages/server/src/memory/state-store.ts` | Added `promotedCandidateFingerprints` to `commitSuccess` patch |
| `packages/server/src/memory/prompts/index.ts` | Updated daily + weekly prompt exports to include `branch:` field |
| `packages/server/src/memory/prompts/daily-distillation.md` | Added `branch:` to candidate format |
| `packages/server/src/memory/prompts/weekly-distillation.md` | Added `branch:` to lesson format |
| `packages/server/src/__tests__/memorize-candidate-parser.test.ts` | NEW — 14 tests |
| `packages/server/src/__tests__/memorize-graph-writer.test.ts` | NEW — 13 tests |
| `packages/server/src/__tests__/memorize-promoter.test.ts` | NEW — 12 tests |
