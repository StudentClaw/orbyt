import { describe, test, expect } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { SkillId } from "@student-claw/contracts"
import { parseSkillFile } from "./SkillParser.js"

function makeTempSkill(
  frontmatter: Record<string, string | string[] | null | undefined>,
  body = "# body\n",
): { skillPath: string; cleanup: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), "orbyt-skill-parser-"))
  mkdirSync(path.join(dir, "skill"), { recursive: true })
  const lines = ["---"]
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined) continue
    if (value === null) {
      lines.push(`${key}: null`)
    } else if (Array.isArray(value)) {
      lines.push(`${key}:`)
      for (const item of value) lines.push(`  - ${item}`)
    } else {
      lines.push(`${key}: ${value}`)
    }
  }
  lines.push("---", "", body)
  const skillPath = path.join(dir, "skill", "SKILL.md")
  writeFileSync(skillPath, lines.join("\n"), "utf8")
  return { skillPath, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

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

describe("SkillParser - Phase 03 expanded metadata", () => {
  test("defaults tier to custom, version to 0.0.0, capabilities to [], and forkedFrom to null when fields are absent", () => {
    const { skillPath, cleanup } = makeTempSkill({
      name: "Sparse Skill",
      description: "Has only the required fields",
    })

    try {
      const resolved = parseSkillFile("sparse" as SkillId, skillPath)
      expect(resolved.tier).toBe("custom")
      expect(resolved.version).toBe("0.0.0")
      expect(resolved.requestedCapabilities).toEqual([])
      expect(resolved.forkedFrom).toBeNull()
    } finally {
      cleanup()
    }
  })

  test("throws on an invalid tier value so it is skipped by the registry rather than silently mistrusted", () => {
    const { skillPath, cleanup } = makeTempSkill({
      name: "Bad Tier",
      description: "Invalid tier",
      tier: "trusted",
    })

    try {
      expect(() => parseSkillFile("bad-tier" as SkillId, skillPath)).toThrow(/tier/)
    } finally {
      cleanup()
    }
  })

  test("exposes tier, version, requestedCapabilities, and forkedFrom when present in frontmatter", () => {
    const { skillPath, cleanup } = makeTempSkill({
      name: "Forked Plan Mode",
      description: "A user fork",
      version: "2.0.0",
      tier: "custom",
      forkedFrom: "plan-mode@1.0.0",
      requested_capabilities: ["canvas.self.read", "calendar.events.write"],
    })

    try {
      const resolved = parseSkillFile("forked-plan-mode" as SkillId, skillPath)

      expect(resolved.tier).toBe("custom")
      expect(resolved.version).toBe("2.0.0")
      expect(resolved.forkedFrom).toBe("plan-mode@1.0.0")
      expect(resolved.requestedCapabilities).toEqual(["canvas.self.read", "calendar.events.write"])
    } finally {
      cleanup()
    }
  })
})
