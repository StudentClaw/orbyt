import { appendFileSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"
import type { MemoryPaths } from "./paths.js"

export interface MemorizeErrorEntry {
  readonly timestamp: string
  readonly context: string
  readonly message: string
  readonly stack?: string
}

export function appendMemorizeError(
  paths: MemoryPaths,
  context: string,
  err: unknown,
): void {
  const error = err instanceof Error ? err : new Error(String(err))
  const entry: MemorizeErrorEntry = {
    timestamp: new Date().toISOString(),
    context,
    message: error.message,
    stack: error.stack,
  }

  try {
    mkdirSync(dirname(paths.errorLog), { recursive: true })
    appendFileSync(paths.errorLog, JSON.stringify(entry) + "\n", "utf-8")
  } catch {
    // Best-effort — don't let error logging itself throw
  }
}
