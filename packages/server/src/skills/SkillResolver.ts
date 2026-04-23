import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Context, Effect, Layer } from "effect"
import type { SkillId } from "@orbyt/contracts"
import { buildSkillRegistry } from "./SkillRegistry.js"
import type { ResolvedSkill } from "./SkillParser.js"

export interface SkillResolverService {
  readonly resolve: (skillId: SkillId) => ResolvedSkill | null
  readonly listAll: () => readonly ResolvedSkill[]
}

export class SkillResolver extends Context.Tag("SkillResolver")<
  SkillResolver,
  SkillResolverService
>() {}

function collectSkillRoots(): string[] {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url))
  const roots = new Set<string>()

  const addRoot = (candidate: string | undefined) => {
    if (!candidate) {
      return
    }

    if (existsSync(candidate)) {
      roots.add(candidate)
    }
  }

  const searchStarts = [
    moduleDir,
    process.cwd(),
  ]

  for (const startDir of searchStarts) {
    let currentDir = startDir
    for (let depth = 0; depth < 8; depth += 1) {
      addRoot(path.join(currentDir, ".agents", "skills"))
      addRoot(path.join(currentDir, "skills"))

      const parentDir = path.dirname(currentDir)
      if (parentDir === currentDir) {
        break
      }
      currentDir = parentDir
    }
  }

  addRoot(process.env.HOME ? path.join(process.env.HOME, ".agents", "skills") : undefined)
  addRoot(process.env.CODEX_HOME_PATH ? path.join(process.env.CODEX_HOME_PATH, ".agents", "skills") : undefined)

  return [...roots]
}

export const SkillResolverLive = Layer.effect(
  SkillResolver,
  Effect.sync(() => {
    const registry = new Map<string, ResolvedSkill>()

    for (const skillsRoot of collectSkillRoots()) {
      for (const [skillId, skill] of buildSkillRegistry(skillsRoot)) {
        if (!registry.has(skillId)) {
          registry.set(skillId, skill)
        }
      }
    }

    return {
      resolve: (skillId: SkillId): ResolvedSkill | null => registry.get(skillId) ?? null,
      listAll: (): readonly ResolvedSkill[] => Array.from(registry.values()),
    }
  }),
)
