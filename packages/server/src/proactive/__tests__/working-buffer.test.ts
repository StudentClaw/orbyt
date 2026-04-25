import { describe, test, expect, beforeEach } from "bun:test"
import { mkdtempSync, rmSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  addNote,
  clearNote,
  ensureWorkingBufferFile,
  formatNotesForPrompt,
  listActiveNotes,
  listAllNotes,
  pruneExpired,
} from "../working-buffer.js"

let dir: string
let bufferPath: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "wb-test-"))
  bufferPath = join(dir, "WORKING_BUFFER.md")
})

function cleanup(): void {
  rmSync(dir, { recursive: true, force: true })
}

describe("working-buffer", () => {
  test("ensureWorkingBufferFile creates a file with the header on first call", () => {
    ensureWorkingBufferFile(bufferPath)
    const text = readFileSync(bufferPath, "utf8")
    expect(text).toContain("# Working Buffer")
    cleanup()
  })

  test("addNote writes a parseable line and assigns an id with wb_ prefix", () => {
    const now = new Date("2026-04-24T12:00:00Z")
    const note = addNote(bufferPath, { text: "watch CS exam", ttlHours: 24, now })
    expect(note.id).toMatch(/^wb_/)
    expect(note.expiresAt).toBe("2026-04-25T12:00:00.000Z")
    const all = listAllNotes(bufferPath)
    expect(all).toHaveLength(1)
    expect(all[0]?.text).toBe("watch CS exam")
    cleanup()
  })

  test("addNote rejects empty text and non-positive TTL", () => {
    expect(() => addNote(bufferPath, { text: "  ", ttlHours: 1 })).toThrow()
    expect(() => addNote(bufferPath, { text: "ok", ttlHours: 0 })).toThrow()
    expect(() => addNote(bufferPath, { text: "ok", ttlHours: -1 })).toThrow()
    cleanup()
  })

  test("listActiveNotes excludes expired notes; pruneExpired removes them from disk", () => {
    const past = new Date("2026-04-20T00:00:00Z")
    const future = new Date("2026-05-01T00:00:00Z")

    addNote(bufferPath, { text: "old note", ttlHours: 1, now: past })
    addNote(bufferPath, { text: "fresh note", ttlHours: 24, now: future })

    const observed = new Date("2026-05-01T01:00:00Z")
    const active = listActiveNotes(bufferPath, observed)
    expect(active).toHaveLength(1)
    expect(active[0]?.text).toBe("fresh note")

    const all = listAllNotes(bufferPath)
    expect(all).toHaveLength(2) // not yet pruned

    const result = pruneExpired(bufferPath, observed)
    expect(result.removed).toBe(1)
    expect(result.remaining).toBe(1)
    expect(listAllNotes(bufferPath)).toHaveLength(1)
    cleanup()
  })

  test("clearNote removes a single note by id and returns true; false when absent", () => {
    const now = new Date("2026-04-24T12:00:00Z")
    const a = addNote(bufferPath, { text: "first", ttlHours: 24, now })
    addNote(bufferPath, { text: "second", ttlHours: 24, now })

    expect(clearNote(bufferPath, a.id)).toBe(true)
    expect(clearNote(bufferPath, a.id)).toBe(false)

    const all = listAllNotes(bufferPath)
    expect(all).toHaveLength(1)
    expect(all[0]?.text).toBe("second")
    cleanup()
  })

  test("formatNotesForPrompt returns a friendly fallback when empty", () => {
    expect(formatNotesForPrompt([])).toBe("(no active notes)")
    cleanup()
  })
})
