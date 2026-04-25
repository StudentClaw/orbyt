import { Context, Effect, Layer } from "effect"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import {
  createProactivePaths,
  type ProactivePaths,
} from "./paths.js"
import {
  ensureSoulFile,
  readSoul,
  writeSoul,
  type SoulWriteResult,
} from "./soul.js"
import {
  addNote,
  clearNote,
  ensureWorkingBufferFile,
  listActiveNotes,
  pruneExpired,
  type AddNoteInput,
  type PruneOutcome,
  type WorkingBufferNote,
} from "./working-buffer.js"

const HEARTBEAT_TEMPLATE = `# Heartbeat scope

> Free-form notes for the heartbeat agent. The user (or the agent itself)
> edits this file to steer what the next heartbeats look for.

- Surface anything urgent across coursework, sessions, or schedule packing.
- Keep replies short. Reply \`HEARTBEAT_OK\` and a brief one-liner if all is calm.
- Watch for items added to the working buffer.
`

function ensureHeartbeatFile(heartbeatPath: string): void {
  if (existsSync(heartbeatPath)) return
  mkdirSync(dirname(heartbeatPath), { recursive: true })
  writeFileSync(heartbeatPath, HEARTBEAT_TEMPLATE, "utf8")
}

export interface ProactiveMemoryShape {
  readonly paths: ProactivePaths

  readonly readSoul: () => string
  readonly writeSoul: (content: string) => SoulWriteResult

  readonly addNote: (input: AddNoteInput) => WorkingBufferNote
  readonly clearNote: (id: string) => boolean
  readonly listActiveNotes: (now?: Date) => ReadonlyArray<WorkingBufferNote>
  readonly pruneExpired: (now?: Date) => PruneOutcome

  readonly ensureScaffold: () => void
}

export class ProactiveMemory extends Context.Tag("ProactiveMemory")<
  ProactiveMemory,
  ProactiveMemoryShape
>() {}

export const ProactiveMemoryLive = Layer.effect(
  ProactiveMemory,
  Effect.sync(() => {
    const paths = createProactivePaths()

    const ensureScaffold = (): void => {
      mkdirSync(paths.root, { recursive: true })
      ensureSoulFile(paths.soulFile)
      ensureHeartbeatFile(paths.heartbeatFile)
      ensureWorkingBufferFile(paths.workingBufferFile)
      mkdirSync(paths.sessionsDir, { recursive: true })
    }

    ensureScaffold()

    return {
      paths,
      readSoul: () => readSoul(paths.soulFile),
      writeSoul: (content) => writeSoul(paths.soulFile, content),
      addNote: (input) => addNote(paths.workingBufferFile, input),
      clearNote: (id) => clearNote(paths.workingBufferFile, id),
      listActiveNotes: (now) => listActiveNotes(paths.workingBufferFile, now),
      pruneExpired: (now) => pruneExpired(paths.workingBufferFile, now),
      ensureScaffold,
    }
  }),
)

export { createProactivePaths, resolveProactiveRoot } from "./paths.js"
export { SOUL_WORD_CAP } from "./soul.js"
export {
  formatNotesForPrompt,
  type WorkingBufferNote,
  type AddNoteInput,
  type PruneOutcome,
} from "./working-buffer.js"
export type { ProactivePaths } from "./paths.js"
