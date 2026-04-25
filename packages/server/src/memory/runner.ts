import type {
  MemorizeRunError,
  MemorizeRunResult,
  MemorizeRunTrigger,
  MemorizeState,
} from "@orbyt/contracts"
import { isoDateKey } from "./week.js"
import type { MemorizeStateStore } from "./state-store.js"

export interface MemorizeTurnInput {
  readonly sinceCursor: MemorizeState["lastProcessedThreadCursor"]
  readonly now: Date
  readonly trigger: MemorizeRunTrigger
}

export interface MemorizeTurnRunner {
  run(input: MemorizeTurnInput): Promise<
    | { readonly ok: true; readonly result: MemorizeRunResult }
    | { readonly ok: false; readonly error: MemorizeRunError }
  >
}

export class NoOpMemorizeTurnRunner implements MemorizeTurnRunner {
  constructor(private readonly store: MemorizeStateStore) {}

  async run(input: MemorizeTurnInput): Promise<
    | { readonly ok: true; readonly result: MemorizeRunResult }
    | { readonly ok: false; readonly error: MemorizeRunError }
  > {
    const now = input.now.toISOString()
    this.store.commitSuccess({
      lastRunAt: now,
      lastProcessedThreadCursor: input.sinceCursor,
      lastDailyFile: null,
      lastWeeklyFile: null,
      lastRolloverDate: isoDateKey(input.now),
      lastAutoRunAt: input.trigger === "auto" ? now : null,
      pendingPromotionCandidates: [],
    })

    return {
      ok: true,
      result: {
        dailyFileWritten: null,
        weeklyFileWritten: null,
        recapFileWritten: null,
        graphNodesUpdated: [],
      },
    }
  }
}
