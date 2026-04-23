import { existsSync, readdirSync } from "node:fs"
import path from "node:path"
import type { SkillId } from "@orbyt/contracts"
import { parseSkillFile, type ResolvedSkill } from "./SkillParser.js"

export type SkillRegistry = ReadonlyMap<string, ResolvedSkill>

export function buildSkillRegistry(skillsRoot: string): SkillRegistry {
  const registry = new Map<string, ResolvedSkill>()

  if (!existsSync(skillsRoot)) {
    return registry
  }

  const entries = readdirSync(skillsRoot, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const skillId = entry.name
    const skillMdPath = path.join(skillsRoot, skillId, "SKILL.md")
    if (!existsSync(skillMdPath)) {
      continue
    }

    try {
      const skill = parseSkillFile(skillId as SkillId, skillMdPath)
      registry.set(skillId, skill)
    } catch (err) {
      process.stderr.write(`[skills] Skipping "${skillId}": ${String(err)}\n`)
    }
  }

  return registry
}
