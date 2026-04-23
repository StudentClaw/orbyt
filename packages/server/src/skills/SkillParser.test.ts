import { describe, test, expect } from "bun:test"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { SkillId } from "@student-claw/contracts"
import { parseSkillFile } from "./SkillParser.js"

const moduleDir = path.dirname(fileURLToPath(import.meta.url))

function findRepoSkillsRoot(): string {
  let current = moduleDir
  for (let depth = 0; depth < 10; depth += 1) {
    const candidate = path.join(current, "skills")
    if (existsSync(path.join(candidate, "plan-mode", "SKILL.md"))) {
      return candidate
    }
    const parent = path.dirname(current)
    if (parent === current) {
      break
    }
    current = parent
  }
  throw new Error("Could not locate repo skills/ root from SkillParser.test.ts")
}

const skillsRoot = findRepoSkillsRoot()

type CuratedSkillExpectation = {
  readonly slug: string
  readonly expectedName: string
  readonly expectedContextKey: string | null
}

const curatedSkills: readonly CuratedSkillExpectation[] = [
  { slug: "plan-mode", expectedName: "Plan Mode", expectedContextKey: "canvas" },
  { slug: "study-helper", expectedName: "Study Helper", expectedContextKey: null },
  { slug: "essay-reviewer", expectedName: "Essay Reviewer", expectedContextKey: null },
  { slug: "exam-prep", expectedName: "Exam Prep", expectedContextKey: null },
  { slug: "citation-helper", expectedName: "Citation Helper", expectedContextKey: null },
  { slug: "explain-like", expectedName: "Explain Like", expectedContextKey: null },
]

describe("SkillParser - curated skills Phase 01 contract", () => {
  test("all six curated skills exist on disk", () => {
    for (const { slug } of curatedSkills) {
      const skillPath = path.join(skillsRoot, slug, "SKILL.md")
      expect(existsSync(skillPath)).toBe(true)
    }
  })

  test("legacy skills/plan/ directory has been removed", () => {
    expect(existsSync(path.join(skillsRoot, "plan"))).toBe(false)
  })

  for (const { slug, expectedName, expectedContextKey } of curatedSkills) {
    test(`parses ${slug} with expanded frontmatter without throwing`, () => {
      const skillPath = path.join(skillsRoot, slug, "SKILL.md")
      const resolved = parseSkillFile(slug as SkillId, skillPath)

      expect(resolved.id).toBe(slug as SkillId)
      expect(resolved.name).toBe(expectedName)
      expect(resolved.description.length).toBeGreaterThan(0)
      expect(resolved.instructions.length).toBeGreaterThan(0)
      expect(resolved.path).toBe(skillPath)
      expect(resolved.contextKey).toBe(expectedContextKey)
    })
  }
})
