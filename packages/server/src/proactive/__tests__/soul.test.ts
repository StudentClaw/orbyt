import { describe, test, expect, beforeEach } from "bun:test"
import { mkdtempSync, rmSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ensureSoulFile, readSoul, writeSoul, SOUL_WORD_CAP } from "../soul.js"

let dir: string
let soulPath: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "soul-test-"))
  soulPath = join(dir, "SOUL.md")
})

function cleanup(): void {
  rmSync(dir, { recursive: true, force: true })
}

describe("soul", () => {
  test("ensureSoulFile seeds a starter template the first time", () => {
    ensureSoulFile(soulPath)
    const text = readFileSync(soulPath, "utf8")
    expect(text).toContain("# Student Soul")
    expect(text).toContain("Current focus")
    cleanup()
  })

  test("ensureSoulFile is idempotent: a second call doesn't overwrite", () => {
    ensureSoulFile(soulPath)
    writeSoul(soulPath, "# Custom\n\nstudent prefers mornings")
    ensureSoulFile(soulPath)
    expect(readSoul(soulPath)).toContain("student prefers mornings")
    cleanup()
  })

  test("writeSoul accepts content under the word cap", () => {
    const result = writeSoul(soulPath, "short content here")
    expect(result.ok).toBe(true)
    expect(result.wordCount).toBe(3)
    expect(readSoul(soulPath)).toBe("short content here")
    cleanup()
  })

  test("writeSoul rejects content over the word cap and leaves the file untouched", () => {
    ensureSoulFile(soulPath)
    const before = readSoul(soulPath)
    const oversized = Array.from({ length: SOUL_WORD_CAP + 10 }, () => "word").join(" ")
    const result = writeSoul(soulPath, oversized)
    expect(result.ok).toBe(false)
    expect(result.wordCount).toBe(SOUL_WORD_CAP + 10)
    expect(readSoul(soulPath)).toBe(before)
    cleanup()
  })
})
