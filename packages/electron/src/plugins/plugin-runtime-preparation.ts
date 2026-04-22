import type { ExtensionRuntimeReadiness } from "@student-claw/contracts"

export type PluginRuntimePreparation =
  | {
    readiness: "ready"
    env?: Record<string, string>
  }
  | {
    readiness: Exclude<ExtensionRuntimeReadiness, "ready">
    lastError: string
    env?: Record<string, string>
  }
