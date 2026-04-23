/**
 * Live 14-day memorize simulation.
 *
 * Runs the real LiveMemorizeTurnRunner with the real Codex-backed distiller,
 * archives all seeded chats plus every daily/weekly distillation output, and
 * writes a report under simulation/memorize-live/.
 *
 * Usage:
 *   bun run packages/server/scripts/memorize-live-sim.ts
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Database as BunDatabase } from "bun:sqlite"
import { initialMemorizeState, type ProviderRuntimeState } from "@orbyt/contracts"
import { buildDailyRunBlock } from "../src/memory/daily-writer.js"
import {
  CodexMemorizeDistiller,
  MEMORIZE_THREAD_ID,
  type MemorizeDistiller,
} from "../src/memory/distiller.js"
import { LiveMemorizeTurnRunner } from "../src/memory/live-runner.js"
import { createMemoryPaths } from "../src/memory/paths.js"
import {
  parseDailyCandidates,
  parseWeeklyCandidates,
} from "../src/memory/candidate-parser.js"
import { weekKeyForDailyDate } from "../src/memory/weekly-writer.js"
import { MemorizeStateStore } from "../src/memory/state-store.js"
import { runMigrations } from "../src/db/migrations/runner.js"
import type { DatabaseService } from "../src/db/Database.js"
import { defaultConfig } from "../src/config/defaults.js"
import { createCodexRuntimeInstance, type CodexCliService } from "../src/ai/CodexCli.js"
import { resolveCodexBinaryPath } from "../src/config/ConfigService.js"
import type { ProviderRuntimeStoreService } from "../src/ai/ProviderRuntimeStore.js"
import type { PluginGatewayService } from "../src/mcp/PluginGateway.js"

type ScenarioTurn = {
  readonly time: string
  readonly threadId: string
  readonly threadTitle: string
  readonly input: string
  readonly output: string
}

type ScenarioDay = {
  readonly date: string
  readonly runHour: number
  readonly focus: readonly string[]
  readonly turns: readonly ScenarioTurn[]
}

type DistillationRecord = {
  readonly kind: "daily" | "weekly"
  readonly dateKey?: string
  readonly weekKey?: string
  readonly sourceDaily?: string
  readonly promptPath: string
  readonly rawOutputPath: string
  readonly renderedOutputPath: string
  readonly headingValid: boolean
  readonly parsedCandidateCount: number
}

type ThemeCheck = {
  readonly id: string
  readonly label: string
  readonly keywords: readonly RegExp[]
}

type ThemeCoverage = {
  readonly label: string
  readonly dailyHits: number
  readonly weeklyHits: number
  readonly graphHits: number
  readonly pendingHits: number
}

const DAILY_HEADINGS = [
  "### Notable Events",
  "### Assignment Observations",
  "### Learning Signals",
  "### Promotion Candidates",
] as const

const WEEKLY_HEADINGS = [
  "## Recurring Struggles",
  "## Recurring Wins",
  "## Emerging Study Strategies",
  "## Candidate Long-Term Lessons",
] as const

const THEME_CHECKS: readonly ThemeCheck[] = [
  {
    id: "morning-focus",
    label: "Morning 7-9 AM focus window",
    keywords: [/7.?9\s*am/i, /morning (?:block|window|focus)/i, /before class/i],
  },
  {
    id: "worked-example",
    label: "Worked examples before theory",
    keywords: [/worked example/i, /example before (?:theory|explanation)/i],
  },
  {
    id: "cs301-submission",
    label: "CS 301 Assignments-tab zip submission rule",
    keywords: [/assignments tab/i, /\bmodules\b/i, /\bzip\b/i],
  },
  {
    id: "no-late-work",
    label: "CS 301 no-late-work / 24h solutions policy",
    keywords: [/late work/i, /24 hours? after/i, /posts solutions/i],
  },
  {
    id: "announcements-check",
    label: "Check Canvas Announcements before starting assignments",
    keywords: [/canvas announcements/i, /announcements before/i, /rubric clarification/i],
  },
  {
    id: "project-phases",
    label: "Research -> implementation -> polish project playbook",
    keywords: [/research.*implementation.*polish/i, /implementation.*polish/i],
  },
  {
    id: "work-shifts",
    label: "Tue/Thu campus help desk shifts",
    keywords: [/tue(?:sday)?\/?thu(?:rsday)?/i, /5-9 pm/i, /help desk/i],
  },
  {
    id: "peer-review",
    label: "Sunday peer review with Maya",
    keywords: [/\bmaya\b/i, /peer review/i, /sunday review/i],
  },
] as const

const DAYS: readonly ScenarioDay[] = [
  {
    date: "2026-04-07",
    runHour: 7,
    focus: [
      "routine candidate: hard work fits best in the 7-9 AM window",
      "personality candidate: wants worked examples before theory",
      "ephemeral assignment detail: CS 301 HW2 doubly linked list",
    ],
    turns: [
      {
        time: "06:08",
        threadId: "thread_planning_routines",
        threadTitle: "Planning and Routines",
        input:
          "I'm best at hard problem solving from 7 to 9 AM before class. Can you remember that when we plan the hard stuff?",
        output:
          "Yes. I would schedule your hardest CS 301 and MATH 201 work in a 7-9 AM block before class because that's when you say your focus is strongest.",
      },
      {
        time: "06:17",
        threadId: "thread_cs301_foundations",
        threadTitle: "CS 301 Foundations",
        input:
          "In CS 301 I need one worked example before the theory or I zone out. Can you explain singly vs doubly linked lists that way? HW2 needs a doubly linked list by Friday.",
        output:
          "Start with a concrete node example, then generalize. For HW2 in CS 301, singly linked lists store one next pointer while doubly linked lists store both prev and next pointers. Your homework is the doubly linked list implementation due Friday.",
      },
    ],
  },
  {
    date: "2026-04-08",
    runHour: 20,
    focus: [
      "work branch candidate: Tue/Thu 5-9 PM campus help desk shift",
      "course branch candidate: CS 301 submit as one zip in Canvas Assignments, not Modules",
    ],
    turns: [
      {
        time: "18:05",
        threadId: "thread_work_schedule",
        threadTitle: "Work Schedule",
        input:
          "Reminder: I work every Tuesday and Thursday from 5-9 PM at the campus help desk, so don't put study blocks there.",
        output:
          "Noted. Tuesday and Thursday from 5-9 PM are blocked for your campus help desk shift, so evening study should go on other days.",
      },
      {
        time: "18:32",
        threadId: "thread_cs301_canvas",
        threadTitle: "CS 301 Canvas Logistics",
        input:
          "Professor Chen said CS 301 HW2 has to be uploaded as one zip in Canvas Assignments, not in Modules. Can you sanity-check where I submit tonight?",
        output:
          "Submit HW2 in the Canvas Assignments tab. Chen's CS 301 workflow is one zip upload there, and Modules is only where the instructions are linked.",
      },
    ],
  },
  {
    date: "2026-04-09",
    runHour: 7,
    focus: [
      "routine reinforcement: calculus also works best in the morning window",
      "ephemeral math assignment details should stay out of the graph",
    ],
    turns: [
      {
        time: "06:06",
        threadId: "thread_math201_drills",
        threadTitle: "MATH 201 Drills",
        input:
          "My calculus recall is strongest in the 7-9 AM window before class. Use that for Problem Set 4. Can you walk me through u-substitution with one worked example first?",
        output:
          "Yes. We'll keep MATH 201 problem sets in your 7-9 AM block. For Problem Set 4, start with a worked example: let u = 3x^2 + 1, then convert the integral before handling the remaining six questions due next Tuesday.",
      },
    ],
  },
  {
    date: "2026-04-10",
    runHour: 7,
    focus: [
      "course branch candidate: Chen posts solutions 24h after deadline and accepts no late work",
      "personality reinforcement: worked example before rule statement",
    ],
    turns: [
      {
        time: "06:09",
        threadId: "thread_cs301_policy",
        threadTitle: "CS 301 Policies",
        input:
          "Professor Chen posts CS 301 solutions 24 hours after the deadline and won't take late work, right? Also show me BST deletion with a worked example before the general rule.",
        output:
          "Right. Chen posts solutions 24 hours after each CS 301 deadline, so late work is effectively off the table. For BST deletion, start with a node that has two children, replace it with the inorder successor, and only after that generalize the cases.",
      },
    ],
  },
  {
    date: "2026-04-11",
    runHour: 7,
    focus: [
      "school branch candidate: checks Canvas Announcements before starting assignments",
      "work shift reinforcement",
    ],
    turns: [
      {
        time: "06:12",
        threadId: "thread_assignment_habits",
        threadTitle: "Assignment Habits",
        input:
          "Before I start any assignment, I always check Canvas Announcements because Chen hides clarifications there. Also plan next week around my Tue/Thu 5-9 PM help desk shifts again.",
        output:
          "That habit makes sense. Check Canvas Announcements before starting any assignment, then place your longest study blocks away from your Tuesday and Thursday 5-9 PM help desk shifts.",
      },
    ],
  },
  {
    date: "2026-04-12",
    runHour: 20,
    focus: [
      "playbook candidate: breaks large projects into research -> implementation -> polish",
      "ephemeral project due date should remain temporary",
    ],
    turns: [
      {
        time: "18:15",
        threadId: "thread_cs301_project",
        threadTitle: "CS 301 Final Project",
        input:
          "For every big project I break it into research, implementation, and polish. Help me scope the CS 301 final that way. The proposal is due on April 21.",
        output:
          "Use your normal three-phase split. Phase 1 is research and topic selection, phase 2 is implementation, and phase 3 is polish plus evaluation notes before the April 21 proposal deadline.",
      },
      {
        time: "18:42",
        threadId: "thread_cs301_midterm_review",
        threadTitle: "CS 301 Midterm Review",
        input:
          "Review heaps and priority queues with me after dinner. I remember them better from examples than pure definitions.",
        output:
          "We'll use a heap insert example and a priority queue example instead of starting from definitions. That's usually the fastest way for you to lock in the rule.",
      },
    ],
  },
  {
    date: "2026-04-13",
    runHour: 7,
    focus: [
      "personality reinforcement: repeated preference for examples",
      "relationship branch candidate: Sunday peer review with Maya",
    ],
    turns: [
      {
        time: "06:11",
        threadId: "thread_cs301_debugging",
        threadTitle: "CS 301 Debugging",
        input:
          "My AVL rotation logic keeps breaking. Give me a worked example before the recurrence explanation again.",
        output:
          "Let's do a left-right rotation example first, then state the recurrence after you can see the tree change. That sequence usually lands better for you than abstract rules first.",
      },
      {
        time: "06:26",
        threadId: "thread_peer_review",
        threadTitle: "Peer Review",
        input:
          "My Sunday review with Maya usually catches the off-by-one mistakes I miss alone. Can we build that into the plan?",
        output:
          "Yes. Your Sunday peer review with Maya seems useful for catching off-by-one errors, so it should stay in the weekly plan when deadlines are close.",
      },
    ],
  },
  {
    date: "2026-04-14",
    runHour: 7,
    focus: [
      "school branch reinforcement: checks announcements before work starts",
      "routine reinforcement: reserve morning block for hard math drills",
    ],
    turns: [
      {
        time: "06:07",
        threadId: "thread_math201_quiz",
        threadTitle: "MATH 201 Quiz Prep",
        input:
          "I checked Canvas Announcements before starting MATH 201 Quiz 3 prep and found a room change. Use the 7-9 AM block for integration by parts drills.",
        output:
          "Good catch on the announcement. We'll keep the integration by parts drills in your 7-9 AM block, since that's still your cleanest window for hard math.",
      },
    ],
  },
  {
    date: "2026-04-15",
    runHour: 7,
    focus: [
      "personality reinforcement: DP clicks after examples",
      "course logistics reinforcement: CS 301 zip submission habit",
    ],
    turns: [
      {
        time: "06:14",
        threadId: "thread_cs301_dp",
        threadTitle: "CS 301 Dynamic Programming",
        input:
          "Dynamic programming makes more sense when you show me one full worked example first. Also HW3 says submit through Assignments again as a zip, right?",
        output:
          "Yes. Start with one complete coin-change table before abstracting the recurrence. And for CS 301 HW3, submit the zip through Canvas Assignments again rather than Modules.",
      },
    ],
  },
  {
    date: "2026-04-16",
    runHour: 20,
    focus: [
      "course policy consequence: starts CS 301 early because late work is impossible",
      "ephemeral midterm recap",
    ],
    turns: [
      {
        time: "18:18",
        threadId: "thread_cs301_post_midterm",
        threadTitle: "CS 301 Post-Midterm",
        input:
          "The no-late-work policy in CS 301 means I have to start assignments at least three days early. Help me reset after the midterm and map that onto HW3.",
        output:
          "That policy does force an earlier start. Since Chen posts solutions a day after the deadline and doesn't take late work, a three-day head start for HW3 is the safer default after the midterm.",
      },
    ],
  },
  {
    date: "2026-04-17",
    runHour: 7,
    focus: [
      "playbook reinforcement: same research -> implementation -> polish split",
      "relationship reinforcement: Maya peer review repeats",
    ],
    turns: [
      {
        time: "06:09",
        threadId: "thread_project_proposal",
        threadTitle: "Project Proposal",
        input:
          "Use the same research -> implementation -> polish breakdown for my project proposal. Maya is doing peer review with me Sunday again.",
        output:
          "Keep the proposal in the same three phases: research the benchmark, implementation for the prototype outline, and polish for the write-up before Maya's Sunday peer review.",
      },
    ],
  },
  {
    date: "2026-04-18",
    runHour: 7,
    focus: [
      "work shift reinforcement",
      "personality reinforcement with another worked-example preference",
    ],
    turns: [
      {
        time: "06:13",
        threadId: "thread_next_week_plan",
        threadTitle: "Next Week Planning",
        input:
          "Don't forget my Tuesday and Thursday 5-9 PM help desk shifts when you place next week's sessions. And give me a worked example before the knapsack explanation.",
        output:
          "I won't place study blocks during your Tuesday or Thursday 5-9 PM help desk shifts. For knapsack, we'll start from one filled table example before writing down the recurrence.",
      },
    ],
  },
  {
    date: "2026-04-19",
    runHour: 7,
    focus: [
      "school branch reinforcement: announcement check catches rubric clarification",
      "routine reinforcement for clean writing window",
    ],
    turns: [
      {
        time: "06:10",
        threadId: "thread_writing_revision",
        threadTitle: "Proposal Revision",
        input:
          "I checked Canvas Announcements before drafting the proposal and there was a rubric clarification. Morning block again please; that's when I do my cleanest writing.",
        output:
          "That announcement check paid off again. Keep proposal drafting in the morning block, because you consistently say your clearest writing happens before class.",
      },
    ],
  },
  {
    date: "2026-04-20",
    runHour: 7,
    focus: [
      "routine reinforcement for final day",
      "playbook reinforcement on final project planning",
    ],
    turns: [
      {
        time: "06:15",
        threadId: "thread_hw3_wrapup",
        threadTitle: "HW3 Wrap-Up",
        input:
          "Let's finish HW3 in my 7-9 AM focus window, then keep the final project in research, implementation, and polish phases.",
        output:
          "That fits your pattern. Finish HW3 in the 7-9 AM focus window, then carry the final project through research, implementation, and polish so the scope stays manageable.",
      },
    ],
  },
] as const

const COURSE_SEEDS = [
  { id: "course_cs301", code: "CS 301", name: "Data Structures" },
  { id: "course_math201", code: "MATH 201", name: "Calculus II" },
  { id: "course_writ110", code: "WRIT 110", name: "College Writing" },
] as const

function repoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
}

function isoDateToDateTime(date: string, time: string): string {
  return `${date}T${time}:00.000Z`
}

function runDate(date: string, hour: number): Date {
  return new Date(`${date}T${String(hour).padStart(2, "0")}:00:00.000Z`)
}

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true })
}

function writeText(path: string, content: string): void {
  ensureDir(dirname(path))
  writeFileSync(path, content, "utf-8")
}

function readText(path: string): string {
  return readFileSync(path, "utf-8")
}

function clearDir(path: string): void {
  rmSync(path, { recursive: true, force: true })
  ensureDir(path)
}

function listMarkdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        return listMarkdownFiles(full).map((child) => join(entry.name, child))
      }
      return entry.name.endsWith(".md") ? [entry.name] : []
    })
    .sort()
}

function listAllFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        return listAllFiles(full).map((child) => join(entry.name, child))
      }
      return [entry.name]
    })
    .sort()
}

function hasHeadingsInOrder(content: string, headings: readonly string[]): boolean {
  let cursor = -1
  for (const heading of headings) {
    const next = content.indexOf(heading, cursor + 1)
    if (next < 0) return false
    cursor = next
  }
  return true
}

function countMatches(content: string, patterns: readonly RegExp[]): number {
  return patterns.filter((pattern) => pattern.test(content)).length
}

function buildThemeCoverage(
  dailyContents: readonly string[],
  weeklyContents: readonly string[],
  graphContents: readonly string[],
  pendingTexts: readonly string[],
): ThemeCoverage[] {
  return THEME_CHECKS.map((theme) => ({
    label: theme.label,
    dailyHits: dailyContents.reduce(
      (count, content) => count + (countMatches(content, theme.keywords) > 0 ? 1 : 0),
      0,
    ),
    weeklyHits: weeklyContents.reduce(
      (count, content) => count + (countMatches(content, theme.keywords) > 0 ? 1 : 0),
      0,
    ),
    graphHits: graphContents.reduce(
      (count, content) => count + (countMatches(content, theme.keywords) > 0 ? 1 : 0),
      0,
    ),
    pendingHits: pendingTexts.reduce(
      (count, content) => count + (countMatches(content, theme.keywords) > 0 ? 1 : 0),
      0,
    ),
  }))
}

function createPluginGatewayHarness(): PluginGatewayService {
  return {
    getInventory: async () => ({
      revision: 0,
      observedAt: new Date(0).toISOString(),
      tools: [],
    }),
    callTool: async (exposedToolName) => ({
      ok: false,
      exposedToolName,
      reason: "tool_not_available",
      message: "Plugin gateway is not configured for the memorize simulation.",
    }),
    subscribeToolsChanged: () => () => undefined,
    dispose: async () => undefined,
  }
}

function createProviderRuntimeStore(): ProviderRuntimeStoreService {
  let state: ProviderRuntimeState = {
    adapter: "codex",
    status: "offline",
    authState: "unknown",
    lastError: null,
    queuedTurnCount: 0,
    lastUpdatedAt: new Date(0).toISOString(),
  }

  return {
    getState: async () => state,
    updateState: async (patch) => {
      state = {
        ...state,
        ...patch,
        lastUpdatedAt: new Date().toISOString(),
      }
      return state
    },
    getThreadSession: async () => null,
    upsertThreadSession: async () => undefined,
    enqueueTurn: async () => undefined,
    dequeueTurn: async () => undefined,
    listQueuedTurns: async () => [],
    refreshQueuedCount: async () => 0,
    drain: async () => undefined,
  }
}

function makeDb(dbPath: string): DatabaseService {
  const bunDb = new BunDatabase(dbPath)
  bunDb.run("PRAGMA journal_mode = WAL")
  bunDb.run("PRAGMA foreign_keys = ON")
  runMigrations(bunDb)
  return {
    db: bunDb,
    get: <T>(sql: string, params?: unknown[]) =>
      bunDb.query<T, unknown[]>(sql).get(params ?? []) as T | null,
    query: <T>(sql: string, params?: unknown[]) =>
      bunDb.query<T, unknown[]>(sql).all(params ?? []) as T[],
    execute: (sql: string, params?: unknown[]) => void bunDb.run(sql, params ?? []),
    transaction: <T>(fn: () => T) => bunDb.transaction(fn)(),
    close: () => bunDb.close(),
  }
}

function seedCourseContext(db: DatabaseService): void {
  for (const course of COURSE_SEEDS) {
    db.execute(
      `INSERT OR IGNORE INTO courses (id, name, code) VALUES (?, ?, ?)`,
      [course.id, course.name, course.code],
    )
  }
}

function ensureMemorizeSystemThread(db: DatabaseService, nowIso: string): void {
  db.execute(
    `INSERT OR IGNORE INTO orchestration_threads
       (id, workspace_id, title, access_mode, status, current_turn_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
    [MEMORIZE_THREAD_ID, "workspace_legacy", "Memorize (system)", "default", "idle", nowIso, nowIso],
  )
}

function seedScenarioTurn(
  db: DatabaseService,
  date: string,
  turn: ScenarioTurn,
  index: number,
): void {
  const completedAt = isoDateToDateTime(date, turn.time)
  const turnId = `${date}-${turn.threadId}-${index + 1}`.replace(/[^a-zA-Z0-9_-]/g, "_")

  db.execute(
    `INSERT OR IGNORE INTO orchestration_threads
       (id, title, access_mode, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [turn.threadId, turn.threadTitle, "default", "idle", completedAt, completedAt],
  )

  db.execute(
    `INSERT INTO orchestration_turns
       (id, thread_id, input_text, output_text, status, started_at, completed_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [turnId, turn.threadId, turn.input, turn.output, "completed", completedAt, completedAt, completedAt],
  )
}

function renderScenarioDay(day: ScenarioDay, index: number): string {
  const lines = [
    `# Day ${String(index + 1).padStart(2, "0")} - ${day.date}`,
    "",
    `Run slot: ${String(day.runHour).padStart(2, "0")}:00 UTC`,
    "",
    "## Intended Coverage",
    "",
    ...day.focus.map((item) => `- ${item}`),
    "",
    "## Simulated Chats",
    "",
  ]

  day.turns.forEach((turn, turnIndex) => {
    lines.push(`### Turn ${turnIndex + 1} - ${turn.time} UTC - ${turn.threadTitle}`)
    lines.push("")
    lines.push(`Thread ID: \`${turn.threadId}\``)
    lines.push("")
    lines.push("**User**")
    lines.push("")
    lines.push(turn.input)
    lines.push("")
    lines.push("**Assistant**")
    lines.push("")
    lines.push(turn.output)
    lines.push("")
  })

  return `${lines.join("\n").trimEnd()}\n`
}

function sanitizeForFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-")
}

function createRecordingDistiller(args: {
  readonly codex: CodexCliService
  readonly outputDir: string
  readonly runTimesByDate: ReadonlyMap<string, Date>
}): { distiller: MemorizeDistiller; records: DistillationRecord[] } {
  const base = new CodexMemorizeDistiller(args.codex)
  const records: DistillationRecord[] = []
  const weeklyRevisions = new Map<string, number>()

  return {
    records,
    distiller: {
      distill: async (prompt: string) => {
        const dailyDate = prompt.match(/## Conversation Turns \((\d{4}-\d{2}-\d{2})\)/)?.[1]
        const weeklyKey = prompt.match(/## Current Weekly File \((\d{4}-W\d{2})\)/)?.[1]
        const sourceDaily = prompt.match(/## Archived Daily Entry \((\d{4}-\d{2}-\d{2})\)/)?.[1]
        const isWeekly = Boolean(weeklyKey)

        const revision = isWeekly
          ? (weeklyRevisions.get(weeklyKey!) ?? 0) + 1
          : 0

        if (isWeekly) {
          weeklyRevisions.set(weeklyKey!, revision)
        }

        const promptStem = isWeekly
          ? `${weeklyKey}-rev-${String(revision).padStart(2, "0")}-from-${sourceDaily ?? "unknown"}`
          : dailyDate ?? `daily-${String(records.length + 1).padStart(2, "0")}`

        const promptPath = join(
          args.outputDir,
          "prompts",
          isWeekly ? "weekly" : "daily",
          `${sanitizeForFilename(promptStem)}.md`,
        )
        writeText(promptPath, prompt.trimEnd() + "\n")

        const output = await base.distill(prompt)

        const rawOutputPath = join(
          args.outputDir,
          "distilled",
          isWeekly ? "weekly-raw" : "daily-raw",
          `${sanitizeForFilename(promptStem)}.md`,
        )
        writeText(rawOutputPath, output.trimEnd() + "\n")

        const renderedOutputPath = join(
          args.outputDir,
          "distilled",
          isWeekly ? "weekly-archive" : "daily-archive",
          `${sanitizeForFilename(promptStem)}.md`,
        )

        if (isWeekly) {
          writeText(
            renderedOutputPath,
            `# Weekly - ${weeklyKey}\n\n${output.trimEnd()}\n`,
          )
        } else if (dailyDate) {
          const runAt = args.runTimesByDate.get(dailyDate) ?? runDate(dailyDate, 7)
          writeText(
            renderedOutputPath,
            `# Daily - ${dailyDate}\n\n${buildDailyRunBlock(output, runAt)}`,
          )
        } else {
          writeText(renderedOutputPath, output.trimEnd() + "\n")
        }

        const headingValid = isWeekly
          ? hasHeadingsInOrder(output, WEEKLY_HEADINGS)
          : hasHeadingsInOrder(output, DAILY_HEADINGS)

        const parsedCandidateCount = isWeekly
          ? parseWeeklyCandidates(output).length
          : parseDailyCandidates(output).length

        records.push({
          kind: isWeekly ? "weekly" : "daily",
          dateKey: dailyDate,
          weekKey: weeklyKey,
          sourceDaily,
          promptPath,
          rawOutputPath,
          renderedOutputPath,
          headingValid,
          parsedCandidateCount,
        })

        return output
      },
    },
  }
}

async function main(): Promise<void> {
  const root = repoRoot()
  const simulationDir = join(root, "simulation", "memorize-live")
  const appHome = join(simulationDir, ".orbyt-home")
  const dbPath = join(simulationDir, "diagnostics", "sim.db")
  const runStartedAt = new Date()
  const runStartedIso = runStartedAt.toISOString()
  const runTimesByDate = new Map(DAYS.map((day) => [day.date, runDate(day.date, day.runHour)]))

  clearDir(simulationDir)
  ensureDir(join(simulationDir, "chats"))
  ensureDir(join(simulationDir, "diagnostics"))

  const db = makeDb(dbPath)
  const paths = createMemoryPaths({ env: { ORBYT_HOME: appHome } })
  const store = new MemorizeStateStore(paths)
  seedCourseContext(db)
  ensureMemorizeSystemThread(db, runStartedIso)

  const codex = createCodexRuntimeInstance({
    config: {
      ...defaultConfig,
      wsAuthToken: "a".repeat(64),
      codexBinaryPath: resolveCodexBinaryPath(),
      codexHomePath: process.env.CODEX_HOME_PATH ?? defaultConfig.codexHomePath,
      codexProcessHomePath: process.env.CODEX_PROCESS_HOME_PATH ?? defaultConfig.codexProcessHomePath,
      codexModel: process.env.CODEX_MODEL ?? defaultConfig.codexModel,
      codexRequestTimeoutMs: process.env.CODEX_REQUEST_TIMEOUT_MS
        ? Number(process.env.CODEX_REQUEST_TIMEOUT_MS)
        : 120_000,
      pluginGatewayBridgeUrl: undefined,
      pluginGatewayBridgeEventsUrl: undefined,
      pluginGatewayBridgeToken: undefined,
      pluginGatewayMcpUrl: undefined,
      pluginGatewayMcpBearerToken: undefined,
      pluginGatewayMcpServerName: defaultConfig.pluginGatewayMcpServerName,
    },
    pluginGateway: createPluginGatewayHarness(),
    runtimeStore: createProviderRuntimeStore(),
  })

  const { distiller, records } = createRecordingDistiller({
    codex,
    outputDir: simulationDir,
    runTimesByDate,
  })

  const runLog: Array<Record<string, unknown>> = []

  try {
    for (let dayIndex = 0; dayIndex < DAYS.length; dayIndex++) {
      const day = DAYS[dayIndex]!
      const now = runDate(day.date, day.runHour)
      writeText(
        join(simulationDir, "chats", `${day.date}.md`),
        renderScenarioDay(day, dayIndex),
      )

      day.turns.forEach((turn, turnIndex) => seedScenarioTurn(db, day.date, turn, turnIndex))

      const stateBefore = store.read()
      const runner = new LiveMemorizeTurnRunner({ db, paths, store, distiller })
      const result = await runner.run({
        sinceCursor: stateBefore.lastProcessedThreadCursor,
        now,
      })

      if (result.ok) {
        runLog.push({
          day: day.date,
          runHour: day.runHour,
          ok: true,
          dailyFileWritten: result.result.dailyFileWritten,
          weeklyFileWritten: result.result.weeklyFileWritten,
          graphNodesUpdated: result.result.graphNodesUpdated,
          pendingCandidateCount: store.read().pendingPromotionCandidates.length,
        })
      } else {
        runLog.push({
          day: day.date,
          runHour: day.runHour,
          ok: false,
          error: result.error,
        })
      }
    }
  } finally {
    await codex.shutdown().catch(() => undefined)
    db.close()
  }

  const finalState = store.read()
  const finalMemoryDir = join(simulationDir, "distilled", "final-memory")
  if (existsSync(paths.root)) {
    cpSync(paths.root, finalMemoryDir, { recursive: true })
  }

  const archivedDailyFiles = listAllFiles(join(simulationDir, "distilled", "daily-archive"))
  const archivedWeeklyFiles = listAllFiles(join(simulationDir, "distilled", "weekly-archive"))
  const finalDailyFiles = listMarkdownFiles(join(finalMemoryDir, "daily"))
  const finalWeeklyFiles = listMarkdownFiles(join(finalMemoryDir, "weekly"))
  const graphFiles = listMarkdownFiles(join(finalMemoryDir, "graph"))

  const dailyRecords = records.filter((record) => record.kind === "daily")
  const weeklyRecords = records.filter((record) => record.kind === "weekly")
  const dailyContents = dailyRecords.map((record) => readText(record.rawOutputPath))
  const weeklyContents = weeklyRecords.map((record) => readText(record.rawOutputPath))
  const graphContents = graphFiles.map((file) => readText(join(finalMemoryDir, "graph", file)))
  const pendingTexts = finalState.pendingPromotionCandidates.map((candidate) => candidate.text)

  const themeCoverage = buildThemeCoverage(
    dailyContents,
    weeklyContents,
    graphContents,
    pendingTexts,
  )

  const summary = {
    generatedAt: new Date().toISOString(),
    model: process.env.CODEX_MODEL ?? defaultConfig.codexModel,
    codexBinaryPath: resolveCodexBinaryPath(),
    scenario: {
      days: DAYS.length,
      startDate: DAYS[0]?.date ?? null,
      endDate: DAYS[DAYS.length - 1]?.date ?? null,
      threads: Array.from(
        new Set(DAYS.flatMap((day) => day.turns.map((turn) => turn.threadId))),
      ).sort(),
      focuses: DAYS.map((day) => ({
        date: day.date,
        focus: day.focus,
      })),
    },
    runLog,
    distillation: {
      dailyCalls: dailyRecords.length,
      weeklyCalls: weeklyRecords.length,
      dailyHeadingValid: dailyRecords.filter((record) => record.headingValid).length,
      weeklyHeadingValid: weeklyRecords.filter((record) => record.headingValid).length,
      dailyParsedCandidates: dailyRecords.reduce(
        (count, record) => count + record.parsedCandidateCount,
        0,
      ),
      weeklyParsedLessons: weeklyRecords.reduce(
        (count, record) => count + record.parsedCandidateCount,
        0,
      ),
    },
    finalMemory: {
      archivedDailyFiles,
      archivedWeeklyFiles,
      retainedDailyFiles: finalDailyFiles,
      retainedWeeklyFiles: finalWeeklyFiles,
      graphFiles,
      pendingCandidates: finalState.pendingPromotionCandidates,
      promotedFingerprintCount: finalState.promotedCandidateFingerprints?.length ?? 0,
      errorLogExists: existsSync(join(finalMemoryDir, "memorize-error.log")),
    },
    themeCoverage,
  }

  writeText(join(simulationDir, "diagnostics", "summary.json"), JSON.stringify(summary, null, 2))
  writeText(join(simulationDir, "diagnostics", "run-log.json"), JSON.stringify(runLog, null, 2))
  if (!existsSync(join(simulationDir, "diagnostics", "initial-state.json"))) {
    writeText(
      join(simulationDir, "diagnostics", "initial-state.json"),
      JSON.stringify(initialMemorizeState(), null, 2),
    )
  }

  const reportLines: string[] = [
    "# Memorize Live Simulation Report",
    "",
    `Generated: ${summary.generatedAt}`,
    `Model: \`${summary.model}\``,
    `Codex binary: \`${summary.codexBinaryPath}\``,
    "",
    "## Scope",
    "",
    `- Simulated ${summary.scenario.days} consecutive days: ${summary.scenario.startDate} through ${summary.scenario.endDate}`,
    `- Used the real \`LiveMemorizeTurnRunner\` plus the real Codex-backed distiller`,
    `- Seeded ${summary.scenario.threads.length} chat threads across planning, CS 301, MATH 201, work scheduling, and peer review`,
    "",
    "## Artifact Layout",
    "",
    "- `chats/` contains the original seeded chats for each day",
    "- `prompts/daily/` and `prompts/weekly/` contain the exact prompts sent to Codex",
    "- `distilled/daily-archive/` contains all 14 daily distillation outputs before retention pruning",
    "- `distilled/weekly-archive/` contains each weekly rewrite as older dailies were folded in",
    "- `distilled/final-memory/` contains the final retained memory tree after the full run",
    "- `diagnostics/summary.json` and `diagnostics/run-log.json` contain the machine-readable results",
    "",
    "## Validation",
    "",
    `- Daily distillation calls: ${summary.distillation.dailyCalls}`,
    `- Weekly distillation calls: ${summary.distillation.weeklyCalls}`,
    `- Daily outputs with required headings in order: ${summary.distillation.dailyHeadingValid}/${summary.distillation.dailyCalls}`,
    `- Weekly outputs with required headings in order: ${summary.distillation.weeklyHeadingValid}/${summary.distillation.weeklyCalls}`,
    `- Parseable daily promotion candidates found: ${summary.distillation.dailyParsedCandidates}`,
    `- Parseable weekly long-term lessons found: ${summary.distillation.weeklyParsedLessons}`,
    `- Archived daily outputs preserved: ${summary.finalMemory.archivedDailyFiles.length}`,
    `- Retained daily files after retention: ${summary.finalMemory.retainedDailyFiles.length}`,
    `- Retained weekly files after retention: ${summary.finalMemory.retainedWeeklyFiles.length}`,
    `- Final graph nodes written: ${summary.finalMemory.graphFiles.length}`,
    `- Pending promotion candidates at end: ${summary.finalMemory.pendingCandidates.length}`,
    `- Error log present: ${summary.finalMemory.errorLogExists ? "yes" : "no"}`,
    "",
    "## Theme Coverage",
    "",
  ]

  themeCoverage.forEach((theme) => {
    reportLines.push(
      `- ${theme.label}: daily=${theme.dailyHits}, weekly=${theme.weeklyHits}, graph=${theme.graphHits}, pending=${theme.pendingHits}`,
    )
  })

  reportLines.push("")
  reportLines.push("## Final Graph Nodes")
  reportLines.push("")
  if (summary.finalMemory.graphFiles.length === 0) {
    reportLines.push("- None written during this run")
  } else {
    summary.finalMemory.graphFiles.forEach((file) => {
      reportLines.push(`- \`${file}\``)
    })
  }

  reportLines.push("")
  reportLines.push("## Pending Candidates")
  reportLines.push("")
  if (summary.finalMemory.pendingCandidates.length === 0) {
    reportLines.push("- None")
  } else {
    summary.finalMemory.pendingCandidates.forEach((candidate) => {
      reportLines.push(
        `- ${candidate.text} (branch: \`${candidate.branch}\`, confidence: ${candidate.confidence}, evidence: ${candidate.evidenceCount})`,
      )
    })
  }

  reportLines.push("")
  reportLines.push("## System Notes")
  reportLines.push("")
  reportLines.push(
    "- Promotion is fragile when the model restates the same durable fact with different wording, because repeated evidence is keyed by an exact text fingerprint rather than semantic similarity.",
  )
  reportLines.push(
    "- Daily and weekly parsing is format-sensitive: if Codex deviates from the exact `candidate:` or `lesson:` bullet shape, the memory pipeline still writes the file but promotion cannot see that fact.",
  )
  reportLines.push(
    "- This run uses real Codex outputs, so the archived files are the ground truth for how the current prompts behave rather than a mocked idealization.",
  )

  writeText(join(simulationDir, "report.md"), reportLines.join("\n") + "\n")

  console.log(`Simulation complete.`)
  console.log(`Artifacts: ${simulationDir}`)
  console.log(`Report: ${join(simulationDir, "report.md")}`)
}

await main()
