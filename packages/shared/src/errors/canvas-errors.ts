import { Data } from "effect"

export class CanvasAuthError extends Data.TaggedError("CanvasAuthError")<{
  readonly message: string
}> {}

export class CanvasApiError extends Data.TaggedError("CanvasApiError")<{
  readonly message: string
  readonly statusCode: number
}> {}
