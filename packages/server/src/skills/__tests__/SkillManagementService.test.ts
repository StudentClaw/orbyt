import { describe, test, expect, afterEach } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import type { SkillId } from "@orbyt/contracts"
import { createSkillManagementService } from "../SkillManagementService.js"
import { createFileSkillGrantStore } from "../SkillGrantStore.js"
import { parseSkillFile } from "../SkillParser.js"

const tempDirs: string[] = []

function mkTmp(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "orbyt-skill-management-"))
  tempDirs.push(dir)
  return dir
}

function writeCurated(skillsRoot: string, slug: string, body = "# How to plan\n"): string {
  const dir = path.join(skillsRoot, slug)
  mkdirSync(dir, { recursive: true })
  const content = [
    "---",
    `name: ${slug}`,
    `description: curated ${slug}`,
    "version: 1.0.0",
    "tier: curated",
    "requested_capabilities:",
    "  - canvas.shared.read",
    "  - calendar.events.write",
    "---",
    "",
    body,
  ].join("\n")
  const p = path.join(dir, "SKILL.md")
  writeFileSync(p, content, "utf8")
  return p
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

describe("createSkillManagementService.fork", () => {
  test("copies a curated skill into the user skills dir with tier=custom and forkedFrom=<slug>@<version>", () => {
    const workspace = mkTmp()
    const curatedRoot = path.join(workspace, "repo-skills")
    const userRoot = path.join(workspace, "user-skills")
    mkdirSync(userRoot, { recursive: true })
    writeCurated(curatedRoot, "plan-mode")

    const grantStore = createFileSkillGrantStore(path.join(workspace, "grants.json"))
    const service = createSkillManagementService({
      userSkillsDir: userRoot,
      curatedRoots: [curatedRoot],
      grantStore,
    })

    const result = service.fork({
      sourceSlug: "plan-mode" as SkillId,
      targetSlug: "my-plan" as SkillId,
    })

    expect(result.skill.id).toBe("my-plan" as SkillId)
    expect(result.skill.tier).toBe("custom")
    expect(result.skill.forkedFrom).toBe("plan-mode@1.0.0")
    expect(result.skill.path.startsWith(userRoot)).toBe(true)

    const forkedPath = path.join(userRoot, "my-plan", "SKILL.md")
    expect(existsSync(forkedPath)).toBe(true)
    const parsed = parseSkillFile("my-plan" as SkillId, forkedPath)
    expect(parsed.tier).toBe("custom")
    expect(parsed.forkedFrom).toBe("plan-mode@1.0.0")
    expect(parsed.instructions).toContain("How to plan")
  })

  test("refuses to overwrite an existing user slug unless force=true", () => {
    const workspace = mkTmp()
    const curatedRoot = path.join(workspace, "repo-skills")
    const userRoot = path.join(workspace, "user-skills")
    mkdirSync(userRoot, { recursive: true })
    writeCurated(curatedRoot, "plan-mode")
    mkdirSync(path.join(userRoot, "my-plan"), { recursive: true })
    writeFileSync(
      path.join(userRoot, "my-plan", "SKILL.md"),
      "---\nname: Existing\ndescription: already here\n---\n",
      "utf8",
    )

    const grantStore = createFileSkillGrantStore(path.join(workspace, "grants.json"))
    const service = createSkillManagementService({
      userSkillsDir: userRoot,
      curatedRoots: [curatedRoot],
      grantStore,
    })

    expect(() =>
      service.fork({ sourceSlug: "plan-mode" as SkillId, targetSlug: "my-plan" as SkillId }),
    ).toThrow(/already exists/i)

    expect(readFileSync(path.join(userRoot, "my-plan", "SKILL.md"), "utf8")).toContain("Existing")
  })

  test("grantCapability persists an allowlisted key and rejects unknown keys", () => {
    const workspace = mkTmp()
    const userRoot = path.join(workspace, "user-skills")
    mkdirSync(userRoot, { recursive: true })
    const grantStore = createFileSkillGrantStore(path.join(workspace, "grants.json"))
    const service = createSkillManagementService({
      userSkillsDir: userRoot,
      curatedRoots: [],
      grantStore,
    })

    const after = service.grantCapability("plan-mode" as SkillId, "calendar.events.write")
    expect(after).toContain("calendar.events.write")
    expect(grantStore.get("plan-mode" as SkillId)).toContain("calendar.events.write")

    expect(() =>
      service.grantCapability("plan-mode" as SkillId, "not.a.real.key"),
    ).toThrow(/unknown capability/i)
  })

  test("revokeCapability removes a single key and leaves others intact", () => {
    const workspace = mkTmp()
    const userRoot = path.join(workspace, "user-skills")
    mkdirSync(userRoot, { recursive: true })
    const grantStore = createFileSkillGrantStore(path.join(workspace, "grants.json"))
    grantStore.grant("plan-mode" as SkillId, ["canvas.shared.read", "calendar.events.write"])

    const service = createSkillManagementService({
      userSkillsDir: userRoot,
      curatedRoots: [],
      grantStore,
    })

    const remaining = service.revokeCapability("plan-mode" as SkillId, "calendar.events.write")
    expect(remaining).toEqual(["canvas.shared.read"])
  })

  test("listForUi merges curated and user skills and surfaces missing capabilities per skill", () => {
    const workspace = mkTmp()
    const curatedRoot = path.join(workspace, "repo-skills")
    const userRoot = path.join(workspace, "user-skills")
    mkdirSync(userRoot, { recursive: true })
    writeCurated(curatedRoot, "plan-mode")

    const grantStore = createFileSkillGrantStore(path.join(workspace, "grants.json"))
    grantStore.grant("plan-mode" as SkillId, ["canvas.shared.read"])

    const service = createSkillManagementService({
      userSkillsDir: userRoot,
      curatedRoots: [curatedRoot],
      grantStore,
    })

    const skills = service.listForUi()
    const plan = skills.find((s) => s.id === "plan-mode")!
    expect(plan.tier).toBe("curated")
    expect(plan.grantedCapabilities).toContain("canvas.shared.read")
    expect(plan.missingCapabilities).toContain("calendar.events.write")
    expect(plan.editable).toBe(false)
  })

  test("refuses to fork an unknown source slug", () => {
    const workspace = mkTmp()
    const userRoot = path.join(workspace, "user-skills")
    mkdirSync(userRoot, { recursive: true })

    const grantStore = createFileSkillGrantStore(path.join(workspace, "grants.json"))
    const service = createSkillManagementService({
      userSkillsDir: userRoot,
      curatedRoots: [path.join(workspace, "nonexistent")],
      grantStore,
    })

    expect(() =>
      service.fork({ sourceSlug: "does-not-exist" as SkillId, targetSlug: "dest" as SkillId }),
    ).toThrow(/source skill/i)
  })
})
