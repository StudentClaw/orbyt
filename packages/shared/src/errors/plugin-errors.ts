import { Data } from "effect"

export class PluginStartError extends Data.TaggedError("PluginStartError")<{
  readonly message: string
  readonly pluginId: string
}> {}

export class PluginToolCallError extends Data.TaggedError("PluginToolCallError")<{
  readonly message: string
  readonly toolName: string
}> {}

export class VaultDecryptError extends Data.TaggedError("VaultDecryptError")<{
  readonly message: string
}> {}
