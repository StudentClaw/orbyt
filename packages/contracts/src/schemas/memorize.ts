import { Schema } from "@effect/schema"

export const MEMORIZE_STATE_FILENAME = "memorize-state.json"
export const MEMORY_ROOT_FILENAME = "MEMORY.md"
export const DAILY_DIR = "daily"
export const WEEKLY_DIR = "weekly"
export const GRAPH_DIR = "graph"

export const SCAFFOLD_BRANCHES = [
  "school",
  "work",
  "relationships",
  "personality",
  "routine",
] as const
export type ScaffoldBranch = (typeof SCAFFOLD_BRANCHES)[number]

export const BASE_GRAPH_NODE_HEADINGS = [
  "## Purpose",
  "## Linked Nodes",
  "## Durable Facts",
  "## Observed Patterns",
  "## Evidence",
] as const

export const COURSE_NODE_HEADINGS = [
  "## Purpose",
  "## Linked Nodes",
  "## Durable Facts",
  "## Canvas Layout",
  "## Professor Patterns",
  "## Assignment Strategy",
  "## Recurring Pitfalls",
  "## Current Improvements",
  "## Observed Patterns",
  "## Evidence",
] as const

export const MEMORY_ROOT_MANAGED_SECTIONS = [
  "## Recent Daily",
  "## Recent Weekly",
] as const

export const DAILY_RETENTION = 7
export const WEEKLY_RETENTION = 4

export const MEMORIZE_STATE_VERSION = 1

export const RunOutcome = Schema.Literal("success", "failed", "partial")
export type RunOutcome = Schema.Schema.Type<typeof RunOutcome>

export const PromotionCandidate = Schema.Struct({
  id: Schema.String,
  source: Schema.String,
  text: Schema.String,
  confidence: Schema.Number,
  firstSeenAt: Schema.String,
  lastSeenAt: Schema.String,
  evidenceCount: Schema.Number,
})
export type PromotionCandidate = Schema.Schema.Type<typeof PromotionCandidate>

export const MemorizeState = Schema.Struct({
  version: Schema.Literal(MEMORIZE_STATE_VERSION),
  lastRunAt: Schema.NullOr(Schema.String),
  lastRunOutcome: Schema.NullOr(RunOutcome),
  lastProcessedThreadCursor: Schema.Record({
    key: Schema.String,
    value: Schema.String,
  }),
  lastDailyFile: Schema.NullOr(Schema.String),
  lastWeeklyFile: Schema.NullOr(Schema.String),
  pendingPromotionCandidates: Schema.Array(PromotionCandidate),
})
export type MemorizeState = Schema.Schema.Type<typeof MemorizeState>

export const initialMemorizeState = (): MemorizeState => ({
  version: MEMORIZE_STATE_VERSION,
  lastRunAt: null,
  lastRunOutcome: null,
  lastProcessedThreadCursor: {},
  lastDailyFile: null,
  lastWeeklyFile: null,
  pendingPromotionCandidates: [],
})

export const CourseNodeFrontmatter = Schema.Struct({
  slug: Schema.String,
  canvasId: Schema.NullOr(Schema.Number),
  canvasName: Schema.String,
  courseCode: Schema.String,
  term: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
})
export type CourseNodeFrontmatter = Schema.Schema.Type<
  typeof CourseNodeFrontmatter
>
