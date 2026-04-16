import { readFileSync } from "node:fs"
import matter from "gray-matter"
import type { SkillId } from "@student-claw/contracts"

export type ResolvedSkill = {
  readonly id: SkillId
  readonly name: string
  readonly description: string
  readonly path: string
  readonly instructions: string
  readonly contextKey: string | null
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
  }
}
