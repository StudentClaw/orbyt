import { afterEach, describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { stageBundledSkills } from "./stage-bundled-skills"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "orbyt-stage-bundled-skills-"))
  tempDirs.push(dir)
  return dir
}

function writeSkill(
  rootDir: string,
  slug: string,
  body: string,
  frontmatter?: Record<string, string>,
): string {
  const skillDir = path.join(rootDir, slug)
  mkdirSync(skillDir, { recursive: true })
  const fm = frontmatter
    ? [
        "---",
        ...Object.entries(frontmatter).map(([key, value]) => `${key}: ${value}`),
        "---",
        "",
      ].join("\n")
    : ""
  const content = `${fm}${body}`
  writeFileSync(path.join(skillDir, "SKILL.md"), content, "utf8")
  return skillDir
}

function sha256(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex")
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe("stageBundledSkills", () => {
  test("manifest contentHash equals sha256 of the staged SKILL.md bytes, and frontmatter version is carried forward", () => {
    const skillsRoot = createTempDir()
    const outputRoot = createTempDir()
    writeSkill(skillsRoot, "plan-mode", "# Plan Mode\nbody content\n", { name: "Plan Mode", version: "1.2.3" })

    const staged = stageBundledSkills({ skillsRoot, outputRoot })

    const stagedFile = path.join(outputRoot, "plan-mode", "SKILL.md")
    const expectedHash = sha256(stagedFile)
    expect(staged).toEqual([{ slug: "plan-mode", version: "1.2.3", contentHash: expectedHash }])

    const manifest = JSON.parse(readFileSync(path.join(outputRoot, "bundled-skills.manifest.json"), "utf8"))
    expect(manifest.skills[0].contentHash).toBe(expectedHash)
    expect(manifest.skills[0].version).toBe("1.2.3")
  })

  test("skips directories that do not contain a SKILL.md and tolerates extra sidecar files in skill dirs", () => {
    const skillsRoot = createTempDir()
    const outputRoot = createTempDir()
    writeSkill(skillsRoot, "plan-mode", "# Plan Mode\n", { name: "Plan Mode", version: "1.0.0" })
    mkdirSync(path.join(skillsRoot, "not-a-skill"), { recursive: true })
    writeFileSync(path.join(skillsRoot, "not-a-skill", "README.md"), "# not a skill\n", "utf8")
    writeFileSync(path.join(skillsRoot, "plan-mode", "scratch.md"), "scratch notes\n", "utf8")

    const staged = stageBundledSkills({ skillsRoot, outputRoot })

    expect(staged.map((entry) => entry.slug)).toEqual(["plan-mode"])
    expect(existsSync(path.join(outputRoot, "not-a-skill"))).toBe(false)
    expect(existsSync(path.join(outputRoot, "plan-mode", "scratch.md"))).toBe(true)
  })

  test("copies each skill directory and emits a manifest alongside the staged output", () => {
    const skillsRoot = createTempDir()
    const outputRoot = createTempDir()
    writeSkill(skillsRoot, "plan-mode", "# Plan Mode\n", { name: "Plan Mode", version: "1.0.0" })
    writeSkill(skillsRoot, "study-helper", "# Study Helper\n", { name: "Study Helper", version: "1.0.0" })

    const staged = stageBundledSkills({ skillsRoot, outputRoot })

    expect(staged.map((entry) => entry.slug)).toEqual(["plan-mode", "study-helper"])
    expect(existsSync(path.join(outputRoot, "plan-mode", "SKILL.md"))).toBe(true)
    expect(existsSync(path.join(outputRoot, "study-helper", "SKILL.md"))).toBe(true)

    const manifestPath = path.join(outputRoot, "bundled-skills.manifest.json")
    expect(existsSync(manifestPath)).toBe(true)
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      version: number
      generatedAt: string
      skills: { slug: string; version: string; contentHash: string }[]
    }
    expect(manifest.version).toBe(1)
    expect(typeof manifest.generatedAt).toBe("string")
    expect(manifest.skills.map((entry) => entry.slug)).toEqual(["plan-mode", "study-helper"])
  })
})
