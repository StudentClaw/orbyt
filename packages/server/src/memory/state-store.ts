import { readFileSync, writeFileSync, existsSync, renameSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { Schema } from "@effect/schema"
import {
  MEMORIZE_STATE_VERSION,
  MemorizeState,
  initialMemorizeState,
} from "@orbyt/contracts"
import { isoDateKey } from "./week.js"
import type { MemoryPaths } from "./paths.js"

const decode = Schema.decodeUnknownSync(MemorizeState)
const encode = Schema.encodeSync(MemorizeState)

function migrate(raw: unknown): MemorizeState {
  if (
    typeof raw !== "object" ||
    raw === null ||
    !("version" in raw)
  ) {
    return decode(raw)
  }
  const v = (raw as Record<string, unknown>)["version"]
  if (v === MEMORIZE_STATE_VERSION) {
    return decode(raw)
  }

  // v1 -> v2: seed new fields. Default lastRolloverDate from prior lastRunAt
  // so the first post-upgrade run does NOT trigger a redundant refold.
  const legacy = raw as Record<string, unknown>
  const lastRunAt =
    typeof legacy["lastRunAt"] === "string"
      ? (legacy["lastRunAt"] as string)
      : null
  const rolloverSeed = lastRunAt
    ? isoDateKey(new Date(lastRunAt))
    : isoDateKey(new Date())
  const migrated = {
    ...legacy,
    version: MEMORIZE_STATE_VERSION,
    lastRolloverDate: rolloverSeed,
    lastAutoRunAt: null,
  }
  return decode(migrated)
}

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
    return migrate(raw)
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
      | "lastRolloverDate"
      | "lastAutoRunAt"
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
