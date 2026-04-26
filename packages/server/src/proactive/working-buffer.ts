import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { createId } from "@orbyt/shared-runtime"

/**
 * `WORKING_BUFFER.md` is a small, line-oriented markdown file. Each note is one
 * line of the form:
 *
 *   - [id: wb_..., planted: <ISO>, expires: <ISO>] free-form text
 *
 * Notes auto-expire — `listActiveNotes` filters them out, and `pruneExpired`
 * physically rewrites the file to drop expired lines on every cron tick.
 */

export interface WorkingBufferNote {
  readonly id: string
  readonly plantedAt: string
  readonly expiresAt: string
  readonly text: string
}

const HEADER = `# Working Buffer

> Short-lived notes the agent plants for itself between heartbeats. Each line
> below is one note. Lines auto-expire and are pruned on every cron tick.

`

const LINE_PATTERN =
  /^- \[id: (wb_[^,]+), planted: ([^,]+), expires: ([^\]]+)\]\s*(.*)$/

function parseLine(line: string): WorkingBufferNote | null {
  const match = LINE_PATTERN.exec(line.trim())
  if (!match) return null
  const [, id, plantedAt, expiresAt, text] = match
  if (!id || !plantedAt || !expiresAt) return null
  return { id, plantedAt, expiresAt, text: text ?? "" }
}

function formatLine(note: WorkingBufferNote): string {
  return `- [id: ${note.id}, planted: ${note.plantedAt}, expires: ${note.expiresAt}] ${note.text}`
}

function read(bufferPath: string): { header: string; notes: WorkingBufferNote[] } {
  if (!existsSync(bufferPath)) {
    return { header: HEADER, notes: [] }
  }
  const raw = readFileSync(bufferPath, "utf8")
  const lines = raw.split(/\r?\n/)
  const noteStart = lines.findIndex((line) => line.startsWith("- ["))
  const header = noteStart === -1 ? raw : `${lines.slice(0, noteStart).join("\n")}\n`
  const noteLines = noteStart === -1 ? [] : lines.slice(noteStart)
  const notes = noteLines
    .map(parseLine)
    .filter((n): n is WorkingBufferNote => n !== null)
  return { header: header.length > 0 ? header : HEADER, notes }
}

function write(
  bufferPath: string,
  header: string,
  notes: ReadonlyArray<WorkingBufferNote>,
): void {
  mkdirSync(dirname(bufferPath), { recursive: true })
  const body = notes.map(formatLine).join("\n")
  writeFileSync(bufferPath, `${header}${body}${body.length > 0 ? "\n" : ""}`, "utf8")
}

export function ensureWorkingBufferFile(bufferPath: string): void {
  if (existsSync(bufferPath)) return
  mkdirSync(dirname(bufferPath), { recursive: true })
  writeFileSync(bufferPath, HEADER, "utf8")
}

export interface AddNoteInput {
  readonly text: string
  readonly ttlHours: number
  readonly now?: Date
}

export function addNote(
  bufferPath: string,
  input: AddNoteInput,
): WorkingBufferNote {
  if (!Number.isFinite(input.ttlHours) || input.ttlHours <= 0) {
    throw new Error(`addNote: ttlHours must be > 0 (got ${input.ttlHours})`)
  }
  const trimmedText = input.text.trim()
  if (trimmedText.length === 0) {
    throw new Error("addNote: text must be non-empty")
  }
  const now = input.now ?? new Date()
  const expiresAt = new Date(now.getTime() + input.ttlHours * 60 * 60 * 1000)
  const note: WorkingBufferNote = {
    id: createId("wb"),
    plantedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    text: trimmedText,
  }
  const { header, notes } = read(bufferPath)
  write(bufferPath, header, [...notes, note])
  return note
}

export function clearNote(bufferPath: string, id: string): boolean {
  const { header, notes } = read(bufferPath)
  const next = notes.filter((n) => n.id !== id)
  if (next.length === notes.length) return false
  write(bufferPath, header, next)
  return true
}

export function listAllNotes(bufferPath: string): ReadonlyArray<WorkingBufferNote> {
  return read(bufferPath).notes
}

export function listActiveNotes(
  bufferPath: string,
  now: Date = new Date(),
): ReadonlyArray<WorkingBufferNote> {
  const ts = now.getTime()
  return read(bufferPath).notes.filter((n) => Date.parse(n.expiresAt) > ts)
}

export interface PruneOutcome {
  readonly removed: number
  readonly remaining: number
}

export function pruneExpired(
  bufferPath: string,
  now: Date = new Date(),
): PruneOutcome {
  const ts = now.getTime()
  const { header, notes } = read(bufferPath)
  const remaining = notes.filter((n) => Date.parse(n.expiresAt) > ts)
  if (remaining.length === notes.length) {
    return { removed: 0, remaining: notes.length }
  }
  write(bufferPath, header, remaining)
  return { removed: notes.length - remaining.length, remaining: remaining.length }
}

export function formatNotesForPrompt(
  notes: ReadonlyArray<WorkingBufferNote>,
): string {
  if (notes.length === 0) return "(no active notes)"
  return notes
    .map((n) => `- (expires ${n.expiresAt}) ${n.text}`)
    .join("\n")
}
