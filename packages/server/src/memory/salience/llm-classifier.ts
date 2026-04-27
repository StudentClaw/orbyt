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

/**
 * Walk the text and return every balanced `{...}` substring. Used to find a
 * verdict JSON object even when the model wrapped the answer in markdown,
 * artifact tags, or trailing prose.
 */
function findJsonObjectCandidates(text: string): string[] {
  const candidates: string[] = []
  let depth = 0
  let start = -1
  let inString = false
  let escape = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (escape) {
      escape = false
      continue
    }
    if (ch === "\\") {
      escape = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === "{") {
      if (depth === 0) start = i
      depth++
    } else if (ch === "}") {
      depth--
      if (depth === 0 && start !== -1) {
        candidates.push(text.slice(start, i + 1))
        start = -1
      }
      if (depth < 0) {
        depth = 0
        start = -1
      }
    }
  }
  return candidates
}

function stripFencesAndArtifacts(raw: string): string {
  let text = raw.trim()
  // Drop fenced code blocks but keep their bodies.
  text = text.replace(/```(?:json)?\s*([\s\S]*?)```/g, (_match, body) => String(body))
  // Strip artifact wrappers — keep inner content.
  text = text.replace(/<artifact\b[^>]*>([\s\S]*?)<\/artifact>/gi, (_match, body) =>
    String(body),
  )
  return text
}

function tryParseVerdict(json: string): SalienceVerdict | null {
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
    // ignore
  }
  return null
}

function parseVerdict(raw: string): SalienceVerdict {
  const cleaned = stripFencesAndArtifacts(raw)
  const candidates = findJsonObjectCandidates(cleaned)

  // Prefer the LAST valid verdict candidate so trailing prose containing braces
  // does not eclipse the model's actual answer. Walking back also works when
  // the daily distillation thread accidentally appends a JSON line.
  for (let i = candidates.length - 1; i >= 0; i--) {
    const verdict = tryParseVerdict(candidates[i]!)
    if (verdict) return verdict
  }

  // Fail-open default: if the classifier output is unparseable, treat the turn
  // as noteworthy so memory writes are not silently lost. The distillation pass
  // is the authoritative filter and will skip if there is genuinely nothing to
  // record.
  process.stderr.write(
    `LlmSalienceClassifier: failed to parse verdict, defaulting to noteworthy=true. Raw=${JSON.stringify(raw.slice(0, 200))}\n`,
  )
  return { noteworthy: true, reason: "classifier output unparseable" }
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
