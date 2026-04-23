import type { MemorizeRunError, MemorizeRunResult, MemorizeState } from "@orbyt/contracts"
import type { MemorizeStateStore } from "./state-store.js"

export interface MemorizeTurnInput {
  readonly sinceCursor: MemorizeState["lastProcessedThreadCursor"]
  readonly now: Date
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
      pendingPromotionCandidates: [],
    })

    return {
      ok: true,
      result: {
        dailyFileWritten: null,
        weeklyFileWritten: null,
        graphNodesUpdated: [],
      },
    }
  }
}
