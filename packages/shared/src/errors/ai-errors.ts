import { Data } from "effect"

export class CodexSpawnError extends Data.TaggedError("CodexSpawnError")<{
  readonly message: string
}> {}

export class CodexTimeoutError extends Data.TaggedError("CodexTimeoutError")<{
  readonly message: string
  readonly timeoutMs: number
}> {}
