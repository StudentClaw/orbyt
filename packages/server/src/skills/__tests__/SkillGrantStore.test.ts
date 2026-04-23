import { describe, test, expect, afterEach } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import type { SkillId } from "@orbyt/contracts"
import { createFileSkillGrantStore } from "../SkillGrantStore.js"

const tempDirs: string[] = []

function mkTmp(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "orbyt-grant-store-"))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

describe("createFileSkillGrantStore", () => {
  test("returns [] for a skill that has no recorded grants", () => {
    const storePath = path.join(mkTmp(), "grants.json")
    const store = createFileSkillGrantStore(storePath)
    expect(store.get("plan-mode" as SkillId)).toEqual([])
  })

  test("grant() persists keys to disk so a fresh store instance reads them back after restart", () => {
    const storePath = path.join(mkTmp(), "grants.json")

    const first = createFileSkillGrantStore(storePath)
    first.grant("plan-mode" as SkillId, ["calendar.events.write", "canvas.shared.read"])
    first.grant("plan-mode" as SkillId, ["canvas.shared.read"]) // duplicate should not double-store

    expect(existsSync(storePath)).toBe(true)

    const second = createFileSkillGrantStore(storePath)
    const keys = [...second.get("plan-mode" as SkillId)].sort()
    expect(keys).toEqual(["calendar.events.write", "canvas.shared.read"])
  })

  test("revoke() removes a single key and leaves other keys intact across restart", () => {
    const storePath = path.join(mkTmp(), "grants.json")
    const first = createFileSkillGrantStore(storePath)
    first.grant("plan-mode" as SkillId, ["calendar.events.write", "canvas.shared.read"])
    first.revoke("plan-mode" as SkillId, ["calendar.events.write"])

    const second = createFileSkillGrantStore(storePath)
    expect([...second.get("plan-mode" as SkillId)]).toEqual(["canvas.shared.read"])
  })

  test("treats a corrupt JSON file as empty grants instead of throwing (so first launch after bad write does not brick)", () => {
    const storePath = path.join(mkTmp(), "grants.json")
    const { writeFileSync } = require("node:fs") as typeof import("node:fs")
    writeFileSync(storePath, "{ not valid json", "utf8")

    const store = createFileSkillGrantStore(storePath)
    expect(store.get("plan-mode" as SkillId)).toEqual([])

    store.grant("plan-mode" as SkillId, ["canvas.shared.read"])
    const raw = JSON.parse(readFileSync(storePath, "utf8")) as {
      skills: Record<string, { grantedKeys: string[] }>
    }
    expect(raw.skills["plan-mode"]?.grantedKeys).toEqual(["canvas.shared.read"])
  })
})
