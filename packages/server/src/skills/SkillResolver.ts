import path from "node:path"
import { Context, Effect, Layer } from "effect"
import type { SkillId } from "@student-claw/contracts"
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

export const SkillResolverLive = Layer.effect(
  SkillResolver,
  Effect.sync(() => {
    const skillsRoot = path.join(process.cwd(), "skills")
    const registry = buildSkillRegistry(skillsRoot)

    return {
      resolve: (skillId: SkillId): ResolvedSkill | null => registry.get(skillId) ?? null,
      listAll: (): readonly ResolvedSkill[] => Array.from(registry.values()),
    }
  }),
)
