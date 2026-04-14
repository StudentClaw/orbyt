import { Data } from "effect"

export class CanvasAuthError extends Data.TaggedError("CanvasAuthError")<{
  readonly message: string
  readonly statusCode?: number
  readonly endpoint?: string
}> {}

export class CanvasApiError extends Data.TaggedError("CanvasApiError")<{
  readonly message: string
  readonly statusCode: number
  readonly endpoint?: string
  readonly retryAfterSeconds?: number
}> {}

export class CanvasRateLimitError extends Data.TaggedError("CanvasRateLimitError")<{
  readonly message: string
  readonly retryAfterSeconds?: number
  readonly endpoint?: string
}> {}

export class CanvasPermissionError extends Data.TaggedError("CanvasPermissionError")<{
  readonly message: string
  readonly endpoint?: string
  readonly courseId?: string
}> {}

export class CanvasDecodeError extends Data.TaggedError("CanvasDecodeError")<{
  readonly message: string
  readonly resource: string
  readonly rawPayload?: string
}> {}
