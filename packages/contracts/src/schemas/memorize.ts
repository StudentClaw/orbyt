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

export const EVIDENCE_COUNT_THRESHOLD = 2
export const IMMEDIATE_PROMOTION_CONFIDENCE = 0.9

export const MEMORIZE_STATE_VERSION = 2
export const FALLBACK_RUN_HOUR = 3

export const RunOutcome = Schema.Literal("success", "failed", "partial")
export type RunOutcome = Schema.Schema.Type<typeof RunOutcome>

export const PromotionCandidate = Schema.Struct({
  id: Schema.String,
  source: Schema.String,
  branch: Schema.String,
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
  lastRolloverDate: Schema.NullOr(Schema.String),
  lastAutoRunAt: Schema.NullOr(Schema.String),
  pendingPromotionCandidates: Schema.Array(PromotionCandidate),
  promotedCandidateFingerprints: Schema.optional(Schema.Array(Schema.String)),
})
export type MemorizeState = Schema.Schema.Type<typeof MemorizeState>

export const initialMemorizeState = (): MemorizeState => ({
  version: MEMORIZE_STATE_VERSION,
  lastRunAt: null,
  lastRunOutcome: null,
  lastProcessedThreadCursor: {},
  lastDailyFile: null,
  lastWeeklyFile: null,
  lastRolloverDate: null,
  lastAutoRunAt: null,
  pendingPromotionCandidates: [],
  promotedCandidateFingerprints: [],
})

export const MemorizeRunTrigger = Schema.Literal("auto", "recap", "manual")
export type MemorizeRunTrigger = Schema.Schema.Type<typeof MemorizeRunTrigger>

export const MemorizeRunResult = Schema.Struct({
  dailyFileWritten: Schema.NullOr(Schema.String),
  weeklyFileWritten: Schema.NullOr(Schema.String),
  recapFileWritten: Schema.NullOr(Schema.String),
  graphNodesUpdated: Schema.Array(Schema.String),
})
export type MemorizeRunResult = Schema.Schema.Type<typeof MemorizeRunResult>

export const MemoryUpdatedEvent = Schema.Struct({
  trigger: MemorizeRunTrigger,
  dailyFileWritten: Schema.NullOr(Schema.String),
  weeklyFileWritten: Schema.NullOr(Schema.String),
  recapFileWritten: Schema.NullOr(Schema.String),
  at: Schema.String,
})
export type MemoryUpdatedEvent = Schema.Schema.Type<typeof MemoryUpdatedEvent>

export const MemorizeRunErrorType = Schema.Literal(
  "runner_failed",
  "state_read_error",
  "state_write_error",
)
export type MemorizeRunErrorType = Schema.Schema.Type<typeof MemorizeRunErrorType>

export const MemorizeRunError = Schema.Struct({
  type: MemorizeRunErrorType,
  message: Schema.String,
})
export type MemorizeRunError = Schema.Schema.Type<typeof MemorizeRunError>

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
