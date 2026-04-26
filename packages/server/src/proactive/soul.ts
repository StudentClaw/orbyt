import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

/**
 * Soft cap on the number of words SOUL.md is allowed to grow to.
 *
 * Enforced by `writeSoul`: anything over this is rejected and the agent must
 * try a smaller rewrite. SOUL.md is injected on every turn, so unchecked drift
 * here directly inflates token cost on every request.
 */
export const SOUL_WORD_CAP = 500

const SOUL_TEMPLATE = `# Student Soul

> Small, agent-curated picture of who the student is right now. Injected as
> context on every turn. Keep it under ${SOUL_WORD_CAP} words.

## Current focus
- (nothing recorded yet)

## Recurring stress points
- (nothing recorded yet)

## Established preferences
- (nothing recorded yet)
`

function countWords(text: string): number {
  const trimmed = text.trim()
  if (trimmed.length === 0) return 0
  return trimmed.split(/\s+/).length
}

export function ensureSoulFile(soulPath: string): void {
  if (existsSync(soulPath)) return
  mkdirSync(dirname(soulPath), { recursive: true })
  writeFileSync(soulPath, SOUL_TEMPLATE, "utf8")
}

export function readSoul(soulPath: string): string {
  if (!existsSync(soulPath)) return ""
  return readFileSync(soulPath, "utf8")
}

export interface SoulWriteResult {
  readonly ok: boolean
  readonly wordCount: number
  readonly reason?: string
}

export function writeSoul(soulPath: string, content: string): SoulWriteResult {
  const wordCount = countWords(content)
  if (wordCount > SOUL_WORD_CAP) {
    return {
      ok: false,
      wordCount,
      reason: `SOUL.md update rejected: ${wordCount} words exceeds ${SOUL_WORD_CAP}-word cap`,
    }
  }
  mkdirSync(dirname(soulPath), { recursive: true })
  writeFileSync(soulPath, content, "utf8")
  return { ok: true, wordCount }
}
