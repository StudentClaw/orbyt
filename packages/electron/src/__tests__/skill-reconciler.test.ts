import { createHash } from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, test } from "bun:test"
import { reconcileBundledSkills } from "../codex/skill-reconciler.js"
import { prepareIsolatedCodexRuntime } from "../codex/runtime.js"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "orbyt-skill-reconciler-"))
  tempDirs.push(dir)
  return dir
}

function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex")
}

type BundledSkillFixture = {
  slug: string
  version: string
  body: string
}

function writeBundle(bundleRoot: string, skills: BundledSkillFixture[]): void {
  mkdirSync(bundleRoot, { recursive: true })
  const manifestSkills: { slug: string; version: string; contentHash: string }[] = []
  for (const skill of skills) {
    const skillDir = path.join(bundleRoot, skill.slug)
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(path.join(skillDir, "SKILL.md"), skill.body, "utf8")
    manifestSkills.push({
      slug: skill.slug,
      version: skill.version,
      contentHash: sha256(skill.body),
    })
  }
  writeFileSync(
    path.join(bundleRoot, "bundled-skills.manifest.json"),
    `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), skills: manifestSkills }, null, 2)}\n`,
    "utf8",
  )
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe("prepareIsolatedCodexRuntime + reconciler", () => {
  test("populates the Codex user-home .agents/skills tree from a bundled skills root on first launch", () => {
    const userDataPath = createTempDir()
    const bundleRoot = createTempDir()
    writeBundle(bundleRoot, [
      { slug: "plan-mode", version: "1.0.0", body: "---\nname: Plan Mode\n---\n# plan\n" },
    ])

    const runtime = prepareIsolatedCodexRuntime(userDataPath, undefined, {
      bundleSkillsRoot: bundleRoot,
    })

    const userSkillPath = path.join(
      runtime.codexProcessHomePath,
      ".agents",
      "skills",
      "plan-mode",
      "SKILL.md",
    )
    expect(existsSync(userSkillPath)).toBe(true)
    expect(readFileSync(userSkillPath, "utf8")).toContain("# plan")
  })
})

describe("reconcileBundledSkills", () => {
  test("returns empty result when the bundled manifest is missing (dev mode without staged bundle)", () => {
    const bundleRoot = createTempDir()
    const userRoot = createTempDir()
    const userSkillsDir = path.join(userRoot, ".agents", "skills")
    const statePath = path.join(userRoot, "skills.state.json")

    const result = reconcileBundledSkills({ bundleRoot, userSkillsDir, statePath })

    expect(result.installed).toEqual([])
    expect(result.skipped).toEqual([])
    expect(existsSync(statePath)).toBe(false)
  })

  test("treats a corrupt skills.state.json as a first install and does not overwrite user markdown", () => {
    const bundleRoot = createTempDir()
    const userRoot = createTempDir()
    const userSkillsDir = path.join(userRoot, ".agents", "skills")
    const statePath = path.join(userRoot, "skills.state.json")

    const userBody = "---\nname: Plan Mode\n---\n# student's own version\n"
    mkdirSync(path.join(userSkillsDir, "plan-mode"), { recursive: true })
    writeFileSync(path.join(userSkillsDir, "plan-mode", "SKILL.md"), userBody, "utf8")
    writeFileSync(statePath, "not json", "utf8")

    const bundledBody = "---\nname: Plan Mode\nversion: 1.0.0\n---\n# bundled body\n"
    writeBundle(bundleRoot, [{ slug: "plan-mode", version: "1.0.0", body: bundledBody }])

    const result = reconcileBundledSkills({ bundleRoot, userSkillsDir, statePath })

    expect(result.installed).toEqual([])
    expect(result.skipped.map((entry) => ({ slug: entry.slug, reason: entry.reason }))).toEqual([
      { slug: "plan-mode", reason: "fork-detected" },
    ])
    expect(readFileSync(path.join(userSkillsDir, "plan-mode", "SKILL.md"), "utf8")).toBe(userBody)
    const rewrittenState = JSON.parse(readFileSync(statePath, "utf8")) as {
      installed: Record<string, { bundledVersion: string; contentHash: string }>
    }
    expect(rewrittenState.installed).toEqual({})
  })

  test("never overwrites a user-edited skill whose bytes diverge from the last-installed bundled hash", () => {
    const bundleRoot = createTempDir()
    const userRoot = createTempDir()
    const userSkillsDir = path.join(userRoot, ".agents", "skills")
    const statePath = path.join(userRoot, "skills.state.json")

    const v1Body = "---\nname: Plan Mode\nversion: 1.0.0\n---\n# v1 body\n"
    const v1Hash = sha256(v1Body)

    const forkBody = "---\nname: Plan Mode\nversion: 1.0.0\n---\n# user fork with custom steps\n"
    mkdirSync(path.join(userSkillsDir, "plan-mode"), { recursive: true })
    writeFileSync(path.join(userSkillsDir, "plan-mode", "SKILL.md"), forkBody, "utf8")
    writeFileSync(
      statePath,
      JSON.stringify({
        version: 1,
        installed: { "plan-mode": { bundledVersion: "1.0.0", contentHash: v1Hash } },
      }),
      "utf8",
    )

    const upgradedBody = "---\nname: Plan Mode\nversion: 1.1.0\n---\n# v1.1 body\n"
    writeBundle(bundleRoot, [{ slug: "plan-mode", version: "1.1.0", body: upgradedBody }])

    const result = reconcileBundledSkills({ bundleRoot, userSkillsDir, statePath })

    expect(result.installed).toEqual([])
    expect(result.skipped.map((entry) => ({ slug: entry.slug, reason: entry.reason }))).toEqual([
      { slug: "plan-mode", reason: "fork-detected" },
    ])
    expect(readFileSync(path.join(userSkillsDir, "plan-mode", "SKILL.md"), "utf8")).toBe(forkBody)
  })

  test("upgrades a user skill when its bytes still match the last-installed bundled hash", () => {
    const bundleRoot = createTempDir()
    const userRoot = createTempDir()
    const userSkillsDir = path.join(userRoot, ".agents", "skills")
    const statePath = path.join(userRoot, "skills.state.json")

    const originalBody = "---\nname: Plan Mode\nversion: 1.0.0\n---\n# v1 body\n"
    const originalHash = sha256(originalBody)

    mkdirSync(path.join(userSkillsDir, "plan-mode"), { recursive: true })
    writeFileSync(path.join(userSkillsDir, "plan-mode", "SKILL.md"), originalBody, "utf8")
    writeFileSync(
      statePath,
      JSON.stringify({
        version: 1,
        installed: { "plan-mode": { bundledVersion: "1.0.0", contentHash: originalHash } },
      }),
      "utf8",
    )

    const upgradedBody = "---\nname: Plan Mode\nversion: 1.1.0\n---\n# v1.1 body\n"
    writeBundle(bundleRoot, [{ slug: "plan-mode", version: "1.1.0", body: upgradedBody }])

    const result = reconcileBundledSkills({ bundleRoot, userSkillsDir, statePath })

    expect(result.installed).toEqual([
      {
        slug: "plan-mode",
        reason: "upgrade",
        bundledVersion: "1.1.0",
        bundledHash: sha256(upgradedBody),
      },
    ])
    expect(readFileSync(path.join(userSkillsDir, "plan-mode", "SKILL.md"), "utf8")).toBe(upgradedBody)

    const state = JSON.parse(readFileSync(statePath, "utf8")) as {
      installed: Record<string, { bundledVersion: string; contentHash: string }>
    }
    expect(state.installed["plan-mode"]).toEqual({
      bundledVersion: "1.1.0",
      contentHash: sha256(upgradedBody),
    })
  })

  test("first install copies every bundled SKILL.md into the user skills dir and records state", () => {
    const bundleRoot = createTempDir()
    const userRoot = createTempDir()
    const userSkillsDir = path.join(userRoot, ".agents", "skills")
    const statePath = path.join(userRoot, "skills.state.json")
    writeBundle(bundleRoot, [
      { slug: "plan-mode", version: "1.0.0", body: "---\nname: Plan Mode\n---\n# plan mode\n" },
      { slug: "study-helper", version: "1.0.0", body: "---\nname: Study Helper\n---\n# study helper\n" },
    ])

    const result = reconcileBundledSkills({
      bundleRoot,
      userSkillsDir,
      statePath,
    })

    expect(existsSync(path.join(userSkillsDir, "plan-mode", "SKILL.md"))).toBe(true)
    expect(existsSync(path.join(userSkillsDir, "study-helper", "SKILL.md"))).toBe(true)
    expect(result.installed.map((entry) => entry.slug).sort()).toEqual(["plan-mode", "study-helper"])
    expect(result.skipped).toEqual([])

    const state = JSON.parse(readFileSync(statePath, "utf8")) as {
      installed: Record<string, { bundledVersion: string; contentHash: string }>
    }
    expect(Object.keys(state.installed).sort()).toEqual(["plan-mode", "study-helper"])
    expect(state.installed["plan-mode"].bundledVersion).toBe("1.0.0")
  })
})
