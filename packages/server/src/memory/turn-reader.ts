import type { DatabaseService } from "../db/Database.js"
import type { MemorizeState } from "@student-claw/contracts"

export const GLOBAL_CURSOR_KEY = "_global"

export interface CompletedTurn {
  readonly id: string
  readonly threadId: string
  readonly input: string
  readonly output: string
  readonly completedAt: string
}

type TurnRow = {
  id: string
  thread_id: string
  input_text: string
  output_text: string
  completed_at: string
}

export function extractGlobalCursor(
  cursor: MemorizeState["lastProcessedThreadCursor"],
): string | null {
  return cursor[GLOBAL_CURSOR_KEY] ?? null
}

export function buildCursor(turns: readonly CompletedTurn[]): MemorizeState["lastProcessedThreadCursor"] {
  if (turns.length === 0) return {}
  const max = turns.reduce((latest, t) =>
    t.completedAt > latest ? t.completedAt : latest,
    turns[0]!.completedAt,
  )
  return { [GLOBAL_CURSOR_KEY]: max }
}

export function readTurnsSince(
  db: DatabaseService,
  cursor: MemorizeState["lastProcessedThreadCursor"],
): CompletedTurn[] {
  const since = extractGlobalCursor(cursor)
  const rows = since
    ? db.query<TurnRow>(
        `SELECT id, thread_id, input_text, output_text, completed_at
         FROM orchestration_turns
         WHERE status = 'completed'
           AND completed_at IS NOT NULL
           AND completed_at > ?
         ORDER BY completed_at ASC`,
        [since],
      )
    : db.query<TurnRow>(
        `SELECT id, thread_id, input_text, output_text, completed_at
         FROM orchestration_turns
         WHERE status = 'completed'
           AND completed_at IS NOT NULL
         ORDER BY completed_at ASC`,
      )

  return rows.map((r) => ({
    id: r.id,
    threadId: r.thread_id,
    input: r.input_text,
    output: r.output_text,
    completedAt: r.completed_at,
  }))
}

export function formatTurnsForPrompt(turns: readonly CompletedTurn[]): string {
  if (turns.length === 0) return "_No conversation turns in this window._"
  return turns
    .map(
      (t, i) =>
        `**Turn ${i + 1}** (${t.completedAt})\n\nUser: ${t.input}\n\nAssistant: ${t.output}`,
    )
    .join("\n\n---\n\n")
}
