# Memorize Live Simulation Report

Generated: 2026-04-21T22:28:05.620Z
Model: `gpt-5.4-mini`
Codex binary: `/Users/rereynrd/School/orbyt/packages/server/node_modules/.bin/codex`

## Scope

- Simulated 14 consecutive days: 2026-04-07 through 2026-04-20
- Used the real `LiveMemorizeTurnRunner` plus the real Codex-backed distiller
- Seeded 18 chat threads across planning, CS 301, MATH 201, work scheduling, and peer review

## Artifact Layout

- `chats/` contains the original seeded chats for each day
- `prompts/daily/` and `prompts/weekly/` contain the exact prompts sent to Codex
- `distilled/daily-archive/` contains all 14 daily distillation outputs before retention pruning
- `distilled/weekly-archive/` contains each weekly rewrite as older dailies were folded in
- `distilled/final-memory/` contains the final retained memory tree after the full run
- `diagnostics/summary.json` and `diagnostics/run-log.json` contain the machine-readable results

## Validation

- Daily distillation calls: 14
- Weekly distillation calls: 7
- Daily outputs with required headings in order: 11/14
- Weekly outputs with required headings in order: 7/7
- Parseable daily promotion candidates found: 25
- Parseable weekly long-term lessons found: 31
- Archived daily outputs preserved: 14
- Retained daily files after retention: 7
- Retained weekly files after retention: 2
- Final graph nodes written: 9
- Pending promotion candidates at end: 9
- Error log present: no

## Theme Coverage

- Morning 7-9 AM focus window: daily=5, weekly=6, graph=1, pending=1
- Worked examples before theory: daily=6, weekly=5, graph=3, pending=2
- CS 301 Assignments-tab zip submission rule: daily=2, weekly=5, graph=1, pending=0
- CS 301 no-late-work / 24h solutions policy: daily=2, weekly=3, graph=1, pending=0
- Check Canvas Announcements before starting assignments: daily=3, weekly=2, graph=2, pending=0
- Research -> implementation -> polish project playbook: daily=3, weekly=0, graph=2, pending=1
- Tue/Thu campus help desk shifts: daily=3, weekly=5, graph=2, pending=0
- Sunday peer review with Maya: daily=2, weekly=1, graph=1, pending=3

## Final Graph Nodes

- `routine/index.md`
- `school/courses/cs-301/index.md`
- `school/playbooks/canvas-announcement-first.md`
- `school/playbooks/example-first-explanations.md`
- `school/playbooks/example-first-learning.md`
- `school/playbooks/project-scoping.md`
- `school/playbooks/project-workflow.md`
- `school/playbooks/worked-example-first.md`
- `work/index.md`

## Pending Candidates

- The student prefers starting problem sets with one worked example before independent practice. (branch: `school/playbooks/worked-example-first`, confidence: 0.72, evidence: 1)
- The student learns technical concepts better from examples than from pure definitions. (branch: `personality`, confidence: 0.89, evidence: 1)
- Maya is a recurring peer-review partner (branch: `relationships`, confidence: 0.86, evidence: 1)
- A safe strategy for CS 301 is to start assignments at least three days early (branch: `school/playbooks/time-management`, confidence: 0.86, evidence: 1)
- Maya is a recurring peer review partner (branch: `relationships`, confidence: 0.71, evidence: 1)
- prefers worked examples before formal explanations of new topics (branch: `school/playbooks/worked-example-first`, confidence: 0.72, evidence: 1)
- The student uses a 7-9 AM focus window for concentrated homework work (branch: `routine`, confidence: 0.78, evidence: 1)
- The student prefers dividing larger projects into research, implementation, and polish phases (branch: `school/playbooks/phase-based-project-work`, confidence: 0.86, evidence: 1)
- Maya is a recurring peer-review partner. (branch: `relationships`, confidence: 0.86, evidence: 1)

## System Notes

- Promotion is fragile when the model restates the same durable fact with different wording, because repeated evidence is keyed by an exact text fingerprint rather than semantic similarity.
- Daily and weekly parsing is format-sensitive: if Codex deviates from the exact `candidate:` or `lesson:` bullet shape, the memory pipeline still writes the file but promotion cannot see that fact.
- This run uses real Codex outputs, so the archived files are the ground truth for how the current prompts behave rather than a mocked idealization.
