import {
  isReadOnlyCapabilityKey,
  logicalKeysForTool,
  type LogicalCapabilityKey,
} from "./CapabilityCatalog.js"
import type { ResolvedSkill } from "./SkillParser.js"

export type ToolCallDescriptor = {
  readonly server: string
  readonly toolName: string
}

export type PolicyInput = {
  readonly skill: ResolvedSkill
  readonly grantedKeys: readonly string[]
  readonly toolCall: ToolCallDescriptor
}

export type PolicyDecision =
  | { readonly decision: "allow"; readonly reason: string }
  | {
      readonly decision: "deny"
      readonly reason: string
      readonly missingCapabilities: readonly string[]
    }

function intersect(required: readonly string[], have: readonly string[]): readonly string[] {
  const set = new Set(have)
  return required.filter((key) => set.has(key))
}

function missing(required: readonly string[], have: readonly string[]): readonly string[] {
  const set = new Set(have)
  return required.filter((key) => !set.has(key))
}

export function evaluateSkillPolicy(input: PolicyInput): PolicyDecision {
  const required = logicalKeysForTool(input.toolCall.server, input.toolCall.toolName)

  if (required.length === 0) {
    return {
      decision: "deny",
      reason: `Tool "${input.toolCall.server}::${input.toolCall.toolName}" has no capability mapping (unknown tool).`,
      missingCapabilities: [],
    }
  }

  const declared = new Set(input.skill.requestedCapabilities)
  const notDeclared = required.filter((key) => !declared.has(key))
  if (notDeclared.length > 0) {
    return {
      decision: "deny",
      reason: `Skill "${input.skill.id}" did not declare: ${notDeclared.join(", ")}.`,
      missingCapabilities: notDeclared,
    }
  }

  const covered = intersect(required, input.grantedKeys)
  if (covered.length === required.length) {
    return {
      decision: "allow",
      reason: `Grant covers all required capabilities for tool "${input.toolCall.toolName}".`,
    }
  }

  if (input.skill.tier === "curated") {
    const allReadOnly = required.every((key: LogicalCapabilityKey) => isReadOnlyCapabilityKey(key))
    if (allReadOnly) {
      return {
        decision: "allow",
        reason: `Curated skill "${input.skill.id}" auto-granted read-only capability.`,
      }
    }
  }

  return {
    decision: "deny",
    reason: `Skill "${input.skill.id}" lacks grant for: ${missing(required, input.grantedKeys).join(", ")}.`,
    missingCapabilities: missing(required, input.grantedKeys),
  }
}
