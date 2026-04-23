import { readFileSync } from "node:fs"
import matter from "gray-matter"
import type { SkillId } from "@orbyt/contracts"

export type SkillTier = "curated" | "custom"

export type ResolvedSkill = {
  readonly id: SkillId
  readonly name: string
  readonly description: string
  readonly path: string
  readonly instructions: string
  readonly contextKey: string | null
  readonly tier: SkillTier
  readonly version: string
  readonly requestedCapabilities: readonly string[]
  readonly forkedFrom: string | null
}

const DEFAULT_VERSION = "0.0.0"
const DEFAULT_TIER: SkillTier = "custom"

function coerceTier(raw: unknown, skillId: SkillId): SkillTier {
  if (raw === undefined || raw === null) return DEFAULT_TIER
  if (typeof raw !== "string") {
    throw new Error(`Skill "${skillId}": frontmatter "tier" must be a string when provided`)
  }
  const normalized = raw.trim().toLowerCase()
  if (normalized === "curated" || normalized === "custom") {
    return normalized
  }
  throw new Error(`Skill "${skillId}": frontmatter "tier" must be "curated" or "custom", got "${raw}"`)
}

function coerceVersion(raw: unknown): string {
  if (raw === undefined || raw === null) return DEFAULT_VERSION
  if (typeof raw === "number") return String(raw)
  if (typeof raw === "string" && raw.trim().length > 0) return raw.trim()
  return DEFAULT_VERSION
}

function coerceRequestedCapabilities(raw: unknown, skillId: SkillId): readonly string[] {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) {
    throw new Error(`Skill "${skillId}": frontmatter "requested_capabilities" must be a YAML list when provided`)
  }
  const result: string[] = []
  for (const entry of raw) {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`Skill "${skillId}": every "requested_capabilities" entry must be a non-empty string`)
    }
    result.push(entry.trim())
  }
  return result
}

function coerceForkedFrom(raw: unknown, skillId: SkillId): string | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error(`Skill "${skillId}": frontmatter "forkedFrom" must be a non-empty string when provided`)
  }
  return raw.trim()
}

export function parseSkillFile(skillId: SkillId, filePath: string): ResolvedSkill {
  const content = readFileSync(filePath, "utf-8")
  const { data, content: body } = matter(content)

  if (typeof data.name !== "string" || data.name.trim() === "") {
    throw new Error(`Skill "${skillId}": SKILL.md must have a non-empty "name" in frontmatter`)
  }

  if (typeof data.description !== "string" || data.description.trim() === "") {
    throw new Error(`Skill "${skillId}": SKILL.md must have a non-empty "description" in frontmatter`)
  }

  return {
    id: skillId,
    name: data.name.trim(),
    description: data.description.trim(),
    path: filePath,
    instructions: body.trim(),
    contextKey: typeof data.context === "string" && data.context.trim() !== "" ? data.context.trim() : null,
    tier: coerceTier(data.tier, skillId),
    version: coerceVersion(data.version),
    requestedCapabilities: coerceRequestedCapabilities(data.requested_capabilities, skillId),
    forkedFrom: coerceForkedFrom(data.forkedFrom, skillId),
  }
}
