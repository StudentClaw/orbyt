import { Data } from "effect"

export class SchemaDecodeError extends Data.TaggedError("SchemaDecodeError")<{
  readonly message: string
}> {}

export class JsonRpcParseError extends Data.TaggedError("JsonRpcParseError")<{
  readonly message: string
}> {}

export class PolicyDeniedError extends Data.TaggedError("PolicyDeniedError")<{
  readonly message: string
  readonly capability: string
}> {}
