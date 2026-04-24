import { SALIENCE_CLASSIFIER_PROMPT, fillTemplate } from "../prompts/index.js"
import type { MemorizeDistiller } from "../distiller.js"
import type {
  SalienceClassifier,
  SalienceTurn,
  SalienceVerdict,
} from "./classifier.js"

function formatTurn(turn: SalienceTurn): string {
  const user = turn.inputText.trim()
  const assistant = turn.outputText.trim()
  return [
    `### User`,
    user.length > 0 ? user : "(empty)",
    ``,
    `### Assistant`,
    assistant.length > 0 ? assistant : "(empty)",
  ].join("\n")
}

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1]!.trim() : trimmed
  const start = body.indexOf("{")
  const end = body.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) return null
  return body.slice(start, end + 1)
}

function parseVerdict(raw: string): SalienceVerdict {
  const json = extractJsonObject(raw)
  if (!json) return { noteworthy: false, reason: "classifier returned no json" }
  try {
    const parsed = JSON.parse(json) as unknown
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "noteworthy" in parsed &&
      typeof (parsed as Record<string, unknown>)["noteworthy"] === "boolean"
    ) {
      const rec = parsed as Record<string, unknown>
      const reason =
        typeof rec["reason"] === "string" ? (rec["reason"] as string) : ""
      return { noteworthy: rec["noteworthy"] as boolean, reason }
    }
  } catch {
    // fall through
  }
  return { noteworthy: false, reason: "classifier returned invalid json" }
}

export class LlmSalienceClassifier implements SalienceClassifier {
  constructor(private readonly distiller: MemorizeDistiller) {}

  async classify(turn: SalienceTurn): Promise<SalienceVerdict> {
    const prompt = fillTemplate(SALIENCE_CLASSIFIER_PROMPT, {
      turn: formatTurn(turn),
    })
    const raw = await this.distiller.distill(prompt)
    return parseVerdict(raw)
  }
}
