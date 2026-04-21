import { readFileSync, writeFileSync, existsSync, renameSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { Schema } from "@effect/schema"
import {
  MemorizeState,
  initialMemorizeState,
} from "@student-claw/contracts"
import type { MemoryPaths } from "./paths.js"

const decode = Schema.decodeUnknownSync(MemorizeState)
const encode = Schema.encodeSync(MemorizeState)

export class MemorizeStateStore {
  private readonly stateFile: string

  constructor(paths: MemoryPaths) {
    this.stateFile = paths.stateFile
  }

  read(): MemorizeState {
    if (!existsSync(this.stateFile)) {
      return initialMemorizeState()
    }
    const raw = JSON.parse(readFileSync(this.stateFile, "utf-8")) as unknown
    return decode(raw)
  }

  write(state: MemorizeState): void {
    const encoded = encode(state)
    const dir = dirname(this.stateFile)
    mkdirSync(dir, { recursive: true })
    const tmp = join(dir, `.memorize-state.tmp.json`)
    writeFileSync(tmp, JSON.stringify(encoded, null, 2), "utf-8")
    renameSync(tmp, this.stateFile)
  }

  commitSuccess(
    patch: Pick<
      MemorizeState,
      | "lastRunAt"
      | "lastProcessedThreadCursor"
      | "lastDailyFile"
      | "lastWeeklyFile"
      | "pendingPromotionCandidates"
      | "promotedCandidateFingerprints"
    >,
  ): void {
    const current = this.read()
    this.write({
      ...current,
      ...patch,
      lastRunOutcome: "success",
    })
  }

  recordFailure(): void {
    const current = this.read()
    this.write({ ...current, lastRunOutcome: "failed" })
  }
}
