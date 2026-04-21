/**
 * 14-day memorize simulation.
 * Runs LiveMemorizeTurnRunner with a scripted mock distiller across 14 daily
 * slots (Apr 7–20, 2026) and prints a human-readable recap at the end.
 *
 * Usage: bun run scripts/memorize-sim.ts
 */

import { mkdtempSync, readdirSync, readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { Database as BunDatabase } from "bun:sqlite"
import { createMemoryPaths } from "../src/memory/paths.js"
import { MemorizeStateStore } from "../src/memory/state-store.js"
import { LiveMemorizeTurnRunner } from "../src/memory/live-runner.js"
import { runMigrations } from "../src/db/migrations/runner.js"
import type { DatabaseService } from "../src/db/Database.js"
import type { MemorizeDistiller } from "../src/memory/distiller.js"

// ─── Scenario ────────────────────────────────────────────────────────────────

const DAYS: Array<{
  date: string
  hour: number
  turns: Array<{ input: string; output: string }>
  dailyOutput: string
}> = [
  {
    date: "2026-04-07",
    hour: 7,
    turns: [
      { input: "How do singly vs doubly linked lists differ?", output: "Singly has one pointer; doubly has two..." },
    ],
    dailyOutput: `### Notable Events

- Covered linked list structures in CS 301 (singly vs doubly)
- Completed reading for Chapter 3

### Assignment Observations

- CS 301 HW2 due 2026-04-10, requires implementing a doubly linked list

### Learning Signals

- Understood pointer manipulation well; struggled with edge cases at head/tail

### Promotion Candidates

- candidate: "starts cs-301 assignments at least 3 days before the deadline" (source: conversation, confidence: 0.7, branch: school/courses/cs-301)
`,
  },
  {
    date: "2026-04-08",
    hour: 7,
    turns: [
      { input: "Walk me through BFS vs DFS on a graph", output: "BFS uses a queue; DFS uses a stack or recursion..." },
      { input: "Where do I submit the CS 301 homework on Canvas?", output: "Go to Assignments tab, find HW2..." },
    ],
    dailyOutput: `### Notable Events

- Studied BFS and DFS graph traversal for CS 301 midterm prep
- Located Canvas submission for HW2

### Assignment Observations

- HW2 must be submitted as a single .zip via Canvas Assignments tab

### Learning Signals

- Grasped BFS queue vs DFS stack distinction quickly; confident on traversal order

### Promotion Candidates

- candidate: "starts cs-301 assignments at least 3 days before the deadline" (source: conversation, confidence: 0.8, branch: school/courses/cs-301)
- candidate: "Canvas Assignments tab is the only submission point for cs-301 — not Modules" (source: conversation, confidence: 0.9, branch: school/courses/cs-301)
`,
  },
  {
    date: "2026-04-09",
    hour: 7,
    turns: [
      { input: "Help me with this MATH 201 integral", output: "Use u-substitution here..." },
    ],
    dailyOutput: `### Notable Events

- Worked through MATH 201 integration problem set in morning session
- Finished 6 of 8 problems before class

### Assignment Observations

- MATH 201 Problem Set 4 due 2026-04-14, 8 problems, submissions via Canvas

### Learning Signals

- Performs best on math in the 7–9 AM window; recall drops noticeably in evening sessions

### Promotion Candidates

- candidate: "studies most effectively in the 7–9 AM window before classes" (source: conversation, confidence: 0.9, branch: routine)
`,
  },
  {
    date: "2026-04-10",
    hour: 7,
    turns: [
      { input: "How do BSTs handle deletion?", output: "Find in-order successor or predecessor..." },
      { input: "What did the professor say about late submissions?", output: "Posts solutions 24h after deadline, no late work accepted..." },
    ],
    dailyOutput: `### Notable Events

- Reviewed binary search tree deletion for CS 301 group study
- Clarified late policy: professor posts solutions 24h after deadline

### Assignment Observations

- CS 301 HW2 submitted on time via Canvas

### Learning Signals

- Confused about inorder-successor vs predecessor choice; needed worked example

### Promotion Candidates

- candidate: "cs-301 professor posts solutions 24 hours after each deadline — late work not accepted" (source: conversation, confidence: 0.75, branch: school/courses/cs-301)
`,
  },
  {
    date: "2026-04-11",
    hour: 7,
    turns: [
      { input: "Debug this CS 301 lab: my tree is unbalanced", output: "Check your rotation logic in insert..." },
    ],
    dailyOutput: `### Notable Events

- Debugged AVL tree rotation bug in CS 301 lab
- Lab submitted after 2 hours of debugging

### Assignment Observations

- CS 301 Lab 4 submitted (AVL trees), graded out of 50

### Learning Signals

- Rotation logic in AVL trees is a recurring stumbling block

### Promotion Candidates

_none_
`,
  },
  {
    date: "2026-04-12",
    hour: 7,
    turns: [
      { input: "Review my notes on heaps before the midterm", output: "Max-heap property: parent >= children..." },
      { input: "When does the professor post solutions?", output: "24 hours after each deadline..." },
    ],
    dailyOutput: `### Notable Events

- Reviewed heap data structure in preparation for CS 301 midterm
- Confirmed solution posting policy with professor again

### Assignment Observations

- CS 301 midterm scheduled 2026-04-16, covers Chapters 1–5

### Learning Signals

- Solid grasp of heap property; priority queue applications still fuzzy

### Promotion Candidates

- candidate: "cs-301 professor posts solutions 24 hours after each deadline — late work not accepted" (source: conversation, confidence: 0.85, branch: school/courses/cs-301)
`,
  },
  {
    date: "2026-04-13",
    hour: 7,
    turns: [
      { input: "Help me plan my study schedule for next week", output: "Block 2h mornings for midterm review..." },
    ],
    dailyOutput: `### Notable Events

- Planned weekly study schedule: 2h morning blocks Mon–Thu before midterm

### Assignment Observations

_none_

### Learning Signals

- Proactively scheduled study time; first time doing structured weekly plan

### Promotion Candidates

_none_
`,
  },
  {
    date: "2026-04-14",
    hour: 7,
    turns: [
      { input: "What's on the MATH 201 quiz tomorrow?", output: "Chapter 7 covers integration by parts..." },
    ],
    dailyOutput: `### Notable Events

- Prepared for MATH 201 quiz covering integration by parts and trig substitution

### Assignment Observations

- MATH 201 Quiz 3 tomorrow (Apr 15), covers Chapter 7

### Learning Signals

- Integration by parts algorithm is solid; trig substitution still needs practice

### Promotion Candidates

- candidate: "always checks Canvas Announcements before starting any assignment to catch last-minute changes" (source: conversation, confidence: 0.85, branch: school)
`,
  },
  {
    date: "2026-04-15",
    hour: 7,
    turns: [
      { input: "Explain dynamic programming memoization", output: "Store subproblem results in a table..." },
    ],
    dailyOutput: `### Notable Events

- Took MATH 201 Quiz 3 (felt confident)
- Studied dynamic programming intro for CS 301

### Assignment Observations

- CS 301 HW3 posted: dynamic programming, due 2026-04-22

### Learning Signals

- Memoization concept clicked immediately; bottom-up vs top-down distinction still blurry

### Promotion Candidates

- candidate: "always checks Canvas Announcements before starting any assignment to catch last-minute changes" (source: conversation, confidence: 0.85, branch: school)
`,
  },
  {
    date: "2026-04-16",
    hour: 7,
    turns: [
      { input: "Help me review for MATH 201 midterm", output: "Focus on improper integrals and series convergence..." },
    ],
    dailyOutput: `### Notable Events

- CS 301 midterm completed — felt well-prepared on trees and graphs
- MATH 201 midterm review session in evening

### Assignment Observations

- MATH 201 midterm 2026-04-18, covers Chapters 6–9

### Learning Signals

- Prefers worked examples over reading theory first — consistently asks for examples before explanations

### Promotion Candidates

- candidate: "prefers seeing a worked example before reading theoretical explanation" (source: conversation, confidence: 0.9, branch: personality)
`,
  },
  {
    date: "2026-04-17",
    hour: 7,
    turns: [
      { input: "Debug this DP solution for longest common subsequence", output: "Your base case is off by one..." },
    ],
    dailyOutput: `### Notable Events

- Fixed off-by-one bug in LCS dynamic programming solution
- 2h evening session for MATH 201 midterm review

### Assignment Observations

- MATH 201 midterm tomorrow (Apr 18)

### Learning Signals

- Off-by-one errors in DP tables are a recurring pitfall

### Promotion Candidates

_none_
`,
  },
  {
    date: "2026-04-18",
    hour: 7,
    turns: [
      { input: "Help me scope the CS 301 final project", output: "Break it into research, implementation, polish phases..." },
    ],
    dailyOutput: `### Notable Events

- MATH 201 midterm done (went well)
- Started scoping CS 301 final project with Claude

### Assignment Observations

- CS 301 final project due 2026-05-01, open topic, team of 2

### Learning Signals

- Naturally breaks large work into research → implementation → polish phases

### Promotion Candidates

- candidate: "breaks large projects into three phases: research, implementation, and polish" (source: conversation, confidence: 0.85, branch: school/playbooks/project-playbook)
`,
  },
  {
    date: "2026-04-19",
    hour: 7,
    turns: [
      { input: "Review my project proposal draft", output: "Solid structure; clarify your evaluation metric..." },
    ],
    dailyOutput: `### Notable Events

- Revised CS 301 final project proposal; clarified evaluation metrics
- HW3 (dynamic programming) halfway done

### Assignment Observations

- CS 301 project proposal due 2026-04-21

### Learning Signals

- Writing proposals improves when given a concrete checklist to follow

### Promotion Candidates

- candidate: "breaks large projects into three phases: research, implementation, and polish" (source: conversation, confidence: 0.85, branch: school/playbooks/project-playbook)
`,
  },
  {
    date: "2026-04-20",
    hour: 7,
    turns: [
      { input: "What should I focus on for CS 301 HW3?", output: "Knapsack and coin-change are the core DP problems..." },
    ],
    dailyOutput: `### Notable Events

- Completed CS 301 HW3 (dynamic programming) — knapsack and coin-change
- Submitted project proposal draft for peer review

### Assignment Observations

- CS 301 HW3 submitted, due 2026-04-22
- Project proposal under peer review

### Learning Signals

- DP pattern recognition improving significantly after 3 sessions

### Promotion Candidates

_none_
`,
  },
]

// Weekly distillation outputs (called when a daily is folded into weekly)
// Keyed by "weekKey-N" where N = fold count for that week
const WEEKLY_OUTPUTS: Record<string, string> = {
  // W15 folds: days Apr 7–12 pruned on runs 8–13
  "2026-W15-1": `## Recurring Struggles

- AVL tree rotation logic — came up in lab and review sessions

## Recurring Wins

- Consistent early submission of CS 301 assignments
- Morning study sessions produced better results

## Emerging Study Strategies

- Blocking 7–9 AM for focused study before classes

## Candidate Long-Term Lessons

- lesson: "cs-301 professor posts solutions 24 hours after deadline — submitting late is never an option" (confidence: 0.85, branch: school/courses/cs-301)
`,
  "2026-W15-2": `## Recurring Struggles

- AVL tree rotations and DP base-case off-by-one errors

## Recurring Wins

- Submitted HW2 and Lab 4 on time
- Morning productivity window is consistent

## Emerging Study Strategies

- Blocking 7–9 AM for focused study
- Checking Canvas Announcements before starting assignments

## Candidate Long-Term Lessons

- lesson: "cs-301 professor posts solutions 24 hours after deadline — submitting late is never an option" (confidence: 0.9, branch: school/courses/cs-301)
- lesson: "morning 7–9 AM is peak study window — schedule hard problems here" (confidence: 0.9, branch: routine)
`,
  "2026-W15-3": `## Recurring Struggles

- DP base-case and rotation edge cases remain weak spots

## Recurring Wins

- All assignments submitted on time
- Effective morning study routine established

## Emerging Study Strategies

- 7–9 AM study blocks
- Canvas Announcements check before each assignment

## Candidate Long-Term Lessons

- lesson: "cs-301 professor posts solutions 24 hours after deadline — submitting late is never an option" (confidence: 0.9, branch: school/courses/cs-301)
- lesson: "morning 7–9 AM is peak study window — schedule hard problems here" (confidence: 0.9, branch: routine)
`,
  // remaining W15 folds just carry forward
  "2026-W15-4": `## Recurring Struggles

_none_

## Recurring Wins

- Completed CS 301 midterm feeling well-prepared
- MATH 201 quiz also confident

## Emerging Study Strategies

- Structured weekly planning pays off

## Candidate Long-Term Lessons

- lesson: "cs-301 professor posts solutions 24 hours after deadline — submitting late is never an option" (confidence: 0.9, branch: school/courses/cs-301)
`,
  "2026-W15-5": `## Recurring Struggles

_none_

## Recurring Wins

- Midterms done, both felt well-prepared

## Emerging Study Strategies

- Pre-midterm blocking: 2h morning sessions the week before

## Candidate Long-Term Lessons

_none_
`,
  "2026-W15-6": `## Recurring Struggles

_none_

## Recurring Wins

- Consistent performance through midterm week

## Emerging Study Strategies

- Morning blocks + Canvas check before each session

## Candidate Long-Term Lessons

_none_
`,
  // W16 fold: Apr 13 pruned on run 14
  "2026-W16-1": `## Recurring Struggles

_none_

## Recurring Wins

- Started structured weekly planning proactively

## Emerging Study Strategies

- Breaking large projects into research → implementation → polish

## Candidate Long-Term Lessons

- lesson: "structured weekly planning in advance of midterms reduces last-minute stress" (confidence: 0.8, branch: routine)
`,
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

function makeDb(dir: string): DatabaseService {
  const bunDb = new BunDatabase(join(dir, "sim.db"))
  bunDb.run("PRAGMA journal_mode = WAL")
  runMigrations(bunDb)
  return {
    db: bunDb,
    get: <T>(sql: string, params?: unknown[]) =>
      bunDb.query<T, unknown[]>(sql).get(params ?? []) as T | null,
    query: <T>(sql: string, params?: unknown[]) =>
      bunDb.query<T, unknown[]>(sql).all(params ?? []) as T[],
    execute: (sql: string, params?: unknown[]) => bunDb.run(sql, params ?? []),
    transaction: <T>(fn: () => T) => bunDb.transaction(fn)(),
    close: () => bunDb.close(),
  }
}

function seedTurn(db: DatabaseService, date: string, idx: number, input: string, output: string) {
  const ts = `${date}T0${5 + idx}:00:00.000Z`
  const threadId = "thread_sim"
  const turnId = `turn_${date}_${idx}`
  db.execute(
    `INSERT OR IGNORE INTO orchestration_threads
       (id, title, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [threadId, "Sim Thread", "idle", ts, ts],
  )
  db.execute(
    `INSERT INTO orchestration_turns
       (id, thread_id, input_text, output_text, status, started_at, completed_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [turnId, threadId, input, output, "completed", ts, ts, ts],
  )
}

// ─── Mock distiller ──────────────────────────────────────────────────────────

function makeDistiller(dayIdx: { current: number }, weeklyFoldCounts: Record<string, number>): MemorizeDistiller {
  return {
    distill: async (prompt: string) => {
      if (prompt.includes("Archived Daily Entry")) {
        // Weekly fold call — figure out which week
        const weekMatch = prompt.match(/Current Weekly File \((\d{4}-W\d{2})\)/)
        const weekKey = weekMatch?.[1] ?? "2026-W15"
        weeklyFoldCounts[weekKey] = (weeklyFoldCounts[weekKey] ?? 0) + 1
        const n = weeklyFoldCounts[weekKey]
        const key = `${weekKey}-${n}`
        return WEEKLY_OUTPUTS[key] ?? WEEKLY_OUTPUTS[`${weekKey}-6`] ?? "## Recurring Struggles\n\n_none_\n\n## Recurring Wins\n\n_none_\n\n## Emerging Study Strategies\n\n_none_\n\n## Candidate Long-Term Lessons\n\n_none_\n"
      }
      // Daily distillation
      const day = DAYS[dayIdx.current]
      return day?.dailyOutput ?? "### Notable Events\n\n_none_\n\n### Promotion Candidates\n\n_none_\n"
    },
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

const dir = mkdtempSync(join(tmpdir(), "memorize-sim-"))
console.log(`\n📁 Memory root: ${dir}/memory\n`)

const db = makeDb(dir)
const paths = createMemoryPaths({ env: { STUDENT_CLAW_HOME: dir } })
const store = new MemorizeStateStore(paths)
const dayIdx = { current: 0 }
const weeklyFoldCounts: Record<string, number> = {}
const distiller = makeDistiller(dayIdx, weeklyFoldCounts)

const log: string[] = []

for (let i = 0; i < DAYS.length; i++) {
  const day = DAYS[i]!
  dayIdx.current = i

  // Seed turns for this day
  for (let j = 0; j < day.turns.length; j++) {
    const t = day.turns[j]!
    seedTurn(db, day.date, j, t.input, t.output)
  }

  const now = new Date(`${day.date}T${String(day.hour).padStart(2, "0")}:00:00.000Z`)
  const state = store.read()
  const result = await new LiveMemorizeTurnRunner({ db, paths, store, distiller }).run({
    sinceCursor: state.lastProcessedThreadCursor,
    now,
  })

  if (!result.ok) {
    log.push(`  Day ${i + 1} (${day.date}): FAILED — ${result.error.message}`)
    continue
  }

  const r = result.result
  const parts: string[] = []
  if (r.dailyFileWritten) parts.push(`daily → ${r.dailyFileWritten}.md`)
  if (r.weeklyFileWritten) parts.push(`weekly → ${r.weeklyFileWritten}.md`)
  if (r.graphNodesUpdated.length > 0) {
    for (const p of r.graphNodesUpdated) {
      parts.push(`graph ← ${p.split("/memory/")[1] ?? p}`)
    }
  }
  log.push(`  Day ${i + 1} (${day.date}): ${parts.length ? parts.join(" | ") : "no output (no new turns)"}`)
}

// ─── Recap ───────────────────────────────────────────────────────────────────

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
console.log("  14-DAY MEMORIZE SIMULATION RECAP")
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
console.log("RUN LOG:\n")
for (const line of log) console.log(line)

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

// Daily files remaining
const dailyFiles = existsSync(paths.dailyDir)
  ? readdirSync(paths.dailyDir).filter((f) => f.endsWith(".md")).sort()
  : []
console.log(`DAILY FILES ON DISK (retention = 7):  ${dailyFiles.length} files`)
for (const f of dailyFiles) console.log(`  ${f}`)

// Weekly files
const weeklyFiles = existsSync(paths.weeklyDir)
  ? readdirSync(paths.weeklyDir).filter((f) => f.endsWith(".md")).sort()
  : []
console.log(`\nWEEKLY FILES ON DISK (retention = 4): ${weeklyFiles.length} files`)
for (const f of weeklyFiles) console.log(`  ${f}`)

// Graph nodes written
function walk(dir: string, base: string): string[] {
  if (!existsSync(dir)) return []
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) results.push(...walk(full, base))
    else if (entry.name.endsWith(".md")) results.push(full.replace(base + "/", ""))
  }
  return results
}
const graphFiles = walk(paths.graphDir, paths.root)
console.log(`\nGRAPH NODES WRITTEN: ${graphFiles.length} files`)
for (const f of graphFiles) console.log(`  ${f}`)

// Final state
const finalState = store.read()
console.log(`\nFINAL STATE:`)
console.log(`  lastRunOutcome:  ${finalState.lastRunOutcome}`)
console.log(`  lastDailyFile:   ${finalState.lastDailyFile}`)
console.log(`  lastWeeklyFile:  ${finalState.lastWeeklyFile}`)
console.log(`  pendingQueue:    ${finalState.pendingPromotionCandidates.length} candidates still pending`)
if (finalState.pendingPromotionCandidates.length > 0) {
  for (const c of finalState.pendingPromotionCandidates) {
    console.log(`    - "${c.text}" (confidence: ${c.confidence}, evidence: ${c.evidenceCount})`)
  }
}
console.log(`  promotedFingerprints: ${(finalState.promotedCandidateFingerprints ?? []).length} total`)

// Print each promoted graph node's key sections
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
console.log("  GRAPH NODE CONTENTS")
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
for (const f of graphFiles) {
  const full = join(paths.root, f)
  const content = readFileSync(full, "utf-8")
  // Show only lines with actual content (skip _none yet_ placeholders)
  const meaningful = content
    .split("\n")
    .filter((l) => l.trim() && !l.includes("_none yet_") && !l.startsWith("---") && !l.startsWith("slug:") && !l.startsWith("canvasId:") && !l.startsWith("canvasName:") && !l.startsWith("courseCode:") && !l.startsWith("term:") && !l.startsWith("createdAt:") && !l.startsWith("updatedAt:"))
    .join("\n")
  console.log(`── ${f}\n${meaningful}\n`)
}

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
console.log(`\nMemory root preserved at: ${dir}/memory`)
console.log("Inspect it with: ls -R that path\n")
