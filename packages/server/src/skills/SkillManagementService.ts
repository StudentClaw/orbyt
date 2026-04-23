import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import matter from "gray-matter"
import path from "node:path"
import type { SkillId } from "@orbyt/contracts"
import { buildMergedSkillRegistry } from "./SkillRegistry.js"
import { parseSkillFile, type ResolvedSkill } from "./SkillParser.js"
import { isKnownCapabilityKey } from "./CapabilityCatalog.js"
import type { SkillGrantStore } from "./SkillGrantStore.js"

export type ForkRequest = {
  readonly sourceSlug: SkillId
  readonly targetSlug: SkillId
  readonly displayName?: string
  readonly force?: boolean
}

export type ForkResult = {
  readonly skill: ResolvedSkill
}

export type ListForUiOptions = {
  readonly includeGrants?: boolean
}

export type SkillListEntry = {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly tier: ResolvedSkill["tier"]
  readonly version: string
  readonly requestedCapabilities: readonly string[]
  readonly grantedCapabilities: readonly string[]
  readonly missingCapabilities: readonly string[]
  readonly forkedFrom: string | null
  readonly editable: boolean
}

export interface SkillManagementService {
  readonly fork: (request: ForkRequest) => ForkResult
  readonly grantCapability: (skillId: SkillId, key: string) => readonly string[]
  readonly revokeCapability: (skillId: SkillId, key: string) => readonly string[]
  readonly listForUi: (opts?: ListForUiOptions) => readonly SkillListEntry[]
}

export type SkillManagementServiceOptions = {
  readonly userSkillsDir: string
  readonly curatedRoots: readonly string[]
  readonly grantStore: SkillGrantStore
}

function replaceFrontmatter(source: string, updates: Record<string, unknown>): string {
  const parsed = matter(source)
  const nextData: Record<string, unknown> = { ...parsed.data }
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) delete nextData[key]
    else nextData[key] = value
  }
  return matter.stringify(parsed.content, nextData)
}

export function createSkillManagementService(
  options: SkillManagementServiceOptions,
): SkillManagementService {
  const { userSkillsDir, curatedRoots, grantStore } = options

  const findCuratedSource = (slug: string): ResolvedSkill | null => {
    for (const root of curatedRoots) {
      const registry = buildMergedSkillRegistry([root])
      const hit = registry.get(slug)
      if (hit) return hit
    }
    return null
  }

  return {
    fork(request) {
      if (!request.sourceSlug || !request.targetSlug) {
        throw new Error("fork: sourceSlug and targetSlug are required")
      }

      const source = findCuratedSource(request.sourceSlug)
      if (!source) {
        throw new Error(`fork: source skill "${request.sourceSlug}" not found in curated roots`)
      }

      const targetDir = path.join(userSkillsDir, request.targetSlug)
      const targetPath = path.join(targetDir, "SKILL.md")
      if (existsSync(targetPath) && !request.force) {
        throw new Error(`fork: target slug "${request.targetSlug}" already exists in user skills dir`)
      }

      const originalMarkdown = readFileSync(source.path, "utf8")
      const forkedMarkdown = replaceFrontmatter(originalMarkdown, {
        name: request.displayName ?? `${source.name} (Fork)`,
        tier: "custom",
        forkedFrom: `${source.id}@${source.version}`,
      })

      mkdirSync(targetDir, { recursive: true })
      writeFileSync(targetPath, forkedMarkdown, "utf8")

      const resolved = parseSkillFile(request.targetSlug as SkillId, targetPath)
      return { skill: resolved }
    },

    grantCapability(skillId, key) {
      if (!isKnownCapabilityKey(key)) {
        throw new Error(`grantCapability: unknown capability key "${key}"`)
      }
      return grantStore.grant(skillId, [key])
    },

    revokeCapability(skillId, key) {
      return grantStore.revoke(skillId, [key])
    },

    listForUi(opts) {
      const roots = [userSkillsDir, ...curatedRoots]
      const registry = buildMergedSkillRegistry(roots)
      const entries: SkillListEntry[] = []
      for (const skill of registry.values()) {
        const granted = opts?.includeGrants === false ? [] : grantStore.get(skill.id)
        const grantedSet = new Set(granted)
        const missing = skill.requestedCapabilities.filter((key) => !grantedSet.has(key))
        entries.push({
          id: skill.id,
          name: skill.name,
          description: skill.description,
          tier: skill.tier,
          version: skill.version,
          requestedCapabilities: skill.requestedCapabilities,
          grantedCapabilities: [...granted],
          missingCapabilities: missing,
          forkedFrom: skill.forkedFrom,
          editable: skill.path.startsWith(userSkillsDir),
        })
      }
      return entries
    },
  }
}
