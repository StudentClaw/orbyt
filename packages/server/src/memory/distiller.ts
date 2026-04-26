import { createId } from "@orbyt/shared-runtime"
import type { CodexCliService } from "../ai/CodexCli.js"

export interface MemorizeDistiller {
  distill(prompt: string): Promise<string>
}

export const MEMORIZE_THREAD_ID = "thread_memorize_system"
export const MEMORIZE_SALIENCE_THREAD_ID = "thread_memorize_salience"

const ARTIFACT_OPEN = /<artifact\b[^>]*>/i
const ARTIFACT_CLOSE = /<\/artifact>/i

/**
 * Strip an `<artifact ...>...</artifact>` wrapper if Codex applied one despite
 * suppressArtifactContract. Memory threads need plain markdown / JSON.
 */
function unwrapArtifact(raw: string): string {
  const openMatch = raw.match(ARTIFACT_OPEN)
  const closeMatch = raw.match(ARTIFACT_CLOSE)
  if (!openMatch || !closeMatch) return raw

  const openEnd = (openMatch.index ?? 0) + openMatch[0].length
  const closeStart = closeMatch.index ?? raw.length
  if (closeStart <= openEnd) return raw

  const inner = raw.slice(openEnd, closeStart).trim()
  const trailing = raw.slice(closeStart + closeMatch[0].length).trim()
  // If the model appended trailing prose (rare leak), drop it and log so we
  // notice. The artifact body is the authoritative answer for memory threads.
  if (trailing.length > 0) {
    process.stderr.write(
      `MemorizeDistiller: dropped ${trailing.length} chars trailing the artifact wrapper.\n`,
    )
  }
  return inner
}

export class CodexMemorizeDistiller implements MemorizeDistiller {
  private readonly memorizeThreadId: string

  constructor(
    private readonly codex: CodexCliService,
    threadId: string = MEMORIZE_THREAD_ID,
  ) {
    this.memorizeThreadId = threadId
  }

  async distill(prompt: string): Promise<string> {
    const turnId = createId("memorize-turn")
    let output = ""

    await new Promise<void>((resolve, reject) => {
      void this.codex.streamTurn({
        localThreadId: this.memorizeThreadId,
        localTurnId: turnId,
        content: prompt,
        suppressArtifactContract: true,
        onToken: async (token) => {
          output += token
        },
        onReasoning: async () => {},
        onCompleted: async () => resolve(),
        onInterrupted: async () =>
          reject(new Error("Memorize distillation was interrupted")),
        onError: async (err) =>
          reject(new Error(`Memorize distillation failed: ${err.message}`)),
        onMcpToolCall: async () => {},
        onApprovalRequest: async () => {},
      })
    })

    return unwrapArtifact(output).trim()
  }
}
