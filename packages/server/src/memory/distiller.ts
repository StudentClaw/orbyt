import { createId } from "@student-claw/shared-runtime"
import type { CodexCliService } from "../ai/CodexCli.js"

export interface MemorizeDistiller {
  distill(prompt: string): Promise<string>
}

export class CodexMemorizeDistiller implements MemorizeDistiller {
  private readonly memorizeThreadId = createId("memorize")

  constructor(private readonly codex: CodexCliService) {}

  async distill(prompt: string): Promise<string> {
    const turnId = createId("memorize-turn")
    let output = ""

    await new Promise<void>((resolve, reject) => {
      void this.codex.streamTurn({
        localThreadId: this.memorizeThreadId,
        localTurnId: turnId,
        content: prompt,
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

    return output
  }
}
