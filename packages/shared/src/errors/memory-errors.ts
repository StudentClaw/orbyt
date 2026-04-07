import { Data } from "effect"

export class MemoryWriteError extends Data.TaggedError("MemoryWriteError")<{
  readonly message: string
}> {}
