import { describe, test, expect, afterEach } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { buildMergedSkillRegistry } from "../SkillRegistry.js"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "orbyt-skill-registry-"))
  tempDirs.push(dir)
  return dir
}

function writeSkill(root: string, slug: string, name: string, description: string, extraFrontmatter = ""): void {
  const skillDir = path.join(root, slug)
  mkdirSync(skillDir, { recursive: true })
  const content = [
    "---",
    `name: ${name}`,
    `description: ${description}`,
    extraFrontmatter,
    "---",
    "",
    "# body",
    "",
  ].filter((line) => line !== "").join("\n")
  writeFileSync(path.join(skillDir, "SKILL.md"), content, "utf8")
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

describe("buildMergedSkillRegistry", () => {
  test("resolves a skill slug from whichever root appears first in priority order (user > repo)", () => {
    const userRoot = createTempDir()
    const repoRoot = createTempDir()
    writeSkill(userRoot, "plan-mode", "User Plan Mode", "forked", "tier: custom")
    writeSkill(repoRoot, "plan-mode", "Bundled Plan Mode", "curated", "tier: curated")

    const registry = buildMergedSkillRegistry([userRoot, repoRoot])

    const resolved = registry.get("plan-mode")
    expect(resolved?.name).toBe("User Plan Mode")
    expect(resolved?.tier).toBe("custom")
    expect(resolved?.path.startsWith(userRoot)).toBe(true)
  })

  test("falls back to a repo root when the higher-priority root does not define the slug", () => {
    const userRoot = createTempDir()
    const repoRoot = createTempDir()
    writeSkill(repoRoot, "study-helper", "Study Helper", "curated helper", "tier: curated")

    const registry = buildMergedSkillRegistry([userRoot, repoRoot])

    expect(registry.get("study-helper")?.tier).toBe("curated")
  })
})
