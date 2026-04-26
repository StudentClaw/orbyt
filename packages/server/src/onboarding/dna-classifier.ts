import { createId } from "@orbyt/shared-runtime"
import {
  ALL_ARCHETYPES,
  buildStudyDna,
  resolveArchetype,
  DASHBOARD_CARD_IDS,
  type DashboardCardId,
} from "@orbyt/shared"
import type { OnboardingAnswers, StudentDna, CardWeight } from "@orbyt/contracts"
import type { CodexCliService } from "../ai/CodexCli.js"
import type { DatabaseService } from "../db/Database.js"

export interface ClassifyDnaOutput {
  readonly dna: StudentDna
  readonly cardWeights: ReadonlyArray<CardWeight>
  readonly source: "codex" | "fallback"
}

export interface DnaClassifier {
  classify(answers: OnboardingAnswers): Promise<ClassifyDnaOutput>
}

const ARCHETYPE_CATALOG_SUMMARY = ALL_ARCHETYPES.map((a) => ({
  id: a.id,
  name: a.name,
  rare: !!a.rare,
  rarity: a.rarity ?? "Common",
  struggle: a.struggle ?? null,
  motivation: a.motivation ?? null,
  recommendedFeatures: a.recommendedFeatures,
  sentimentAnchors: a.sentimentAnchors,
}))

const PROMPT_INSTRUCTIONS = `You are the Orbyt Study DNA classifier. Given a student's 11 onboarding answers and a catalog of 50 archetypes, return a JSON object with the best-matching archetype and a relevance score for each dashboard card.

Rules:
- Return ONLY valid JSON. No prose, no markdown fences.
- archetypeId MUST be one of the catalog ids.
- cardWeights must include every dashboard card id, with weights in [0, 1].
- Higher weight = more relevant to this student. The card with weight 1.0 is the one that should be most prominent.
- Prefer rare archetypes when their sentiment triggers fire in the open-ended answers.

Output schema:
{
  "archetypeId": "<id>",
  "cardWeights": { "grade-insights": 0..1, "weekly-outlook": 0..1, "ai-insight": 0..1, "coursework": 0..1, "plan-my-week": 0..1 }
}`

interface CodexJsonResult {
  archetypeId: string
  cardWeights: Record<string, number>
}

function buildPrompt(answers: OnboardingAnswers): string {
  return [
    PROMPT_INSTRUCTIONS,
    "",
    "ANSWERS:",
    JSON.stringify(answers, null, 2),
    "",
    "ARCHETYPE_CATALOG:",
    JSON.stringify(ARCHETYPE_CATALOG_SUMMARY),
    "",
    "DASHBOARD_CARD_IDS:",
    JSON.stringify(DASHBOARD_CARD_IDS),
    "",
    "Return JSON now.",
  ].join("\n")
}

function extractJson(raw: string): CodexJsonResult | null {
  const trimmed = raw.trim()
  const jsonStart = trimmed.indexOf("{")
  const jsonEnd = trimmed.lastIndexOf("}")
  if (jsonStart < 0 || jsonEnd <= jsonStart) return null
  const slice = trimmed.slice(jsonStart, jsonEnd + 1)
  try {
    const parsed = JSON.parse(slice) as CodexJsonResult
    if (typeof parsed.archetypeId !== "string") return null
    if (!parsed.cardWeights || typeof parsed.cardWeights !== "object") return null
    return parsed
  } catch {
    return null
  }
}

function normalizeWeights(weights: Record<string, number>): CardWeight[] {
  return DASHBOARD_CARD_IDS.map((cardId): CardWeight => {
    const raw = weights[cardId]
    const num = typeof raw === "number" && Number.isFinite(raw) ? raw : 0.5
    const clamped = Math.max(0, Math.min(1, num))
    return { cardId, weight: clamped }
  })
}

function fallbackCardWeights(answers: OnboardingAnswers): CardWeight[] {
  const archetype = resolveArchetype(answers)
  const features = new Set(archetype.recommendedFeatures)
  const weight = (cardId: DashboardCardId): number => {
    switch (cardId) {
      case "grade-insights":
        return features.has("gpa_tracker") || features.has("grade_projector") || answers.motivation === "grades" ? 0.95 : 0.5
      case "weekly-outlook":
        return features.has("daily_top3") || answers.struggle === "overwhelm" ? 0.9 : 0.6
      case "ai-insight":
        return features.has("validation_messages") || features.has("micro_steps") || answers.struggle === "stress" ? 0.85 : 0.5
      case "coursework":
        return 0.8
      case "plan-my-week":
        return features.has("advanced_planner") || features.has("system_mode") ? 0.95 : 0.7
      default:
        return 0.5
    }
  }
  return DASHBOARD_CARD_IDS.map((cardId) => ({ cardId, weight: weight(cardId) }))
}

export class CodexDnaClassifier implements DnaClassifier {
  constructor(
    private readonly codex: CodexCliService,
    private readonly db: DatabaseService,
  ) {}

  async classify(answers: OnboardingAnswers): Promise<ClassifyDnaOutput> {
    const threadId = `dna-classify-${createId("dna")}`
    const turnId = createId("dna-turn")
    const nowIso = new Date().toISOString()

    this.db.execute(
      `INSERT OR IGNORE INTO orchestration_threads
         (id, workspace_id, title, access_mode, status, current_turn_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
      [threadId, "workspace_legacy", "DNA classifier (system)", "default", "idle", nowIso, nowIso],
    )

    const prompt = buildPrompt(answers)
    let output = ""
    let codexFailed = false

    try {
      await new Promise<void>((resolve, reject) => {
        void this.codex.streamTurn({
          localThreadId: threadId,
          localTurnId: turnId,
          content: prompt,
          onToken: async (token) => {
            output += token
          },
          onReasoning: async () => {},
          onCompleted: async () => resolve(),
          onInterrupted: async () => reject(new Error("DNA classification interrupted")),
          onError: async (err) => reject(new Error(`DNA classification failed: ${err.message}`)),
          onMcpToolCall: async () => {},
          onApprovalRequest: async () => {},
        })
      })
    } catch {
      codexFailed = true
    }

    // Kill the thread immediately — single use, never reused.
    try {
      this.db.execute("DELETE FROM orchestration_turns WHERE thread_id = ?", [threadId])
      this.db.execute("DELETE FROM orchestration_threads WHERE id = ?", [threadId])
    } catch {
      // best-effort cleanup
    }

    if (codexFailed) {
      return {
        dna: buildStudyDna(answers),
        cardWeights: fallbackCardWeights(answers),
        source: "fallback",
      }
    }

    const parsed = extractJson(output)
    if (!parsed) {
      return {
        dna: buildStudyDna(answers),
        cardWeights: fallbackCardWeights(answers),
        source: "fallback",
      }
    }

    const matched = ALL_ARCHETYPES.find((a) => a.id === parsed.archetypeId)
    if (!matched) {
      return {
        dna: buildStudyDna(answers),
        cardWeights: normalizeWeights(parsed.cardWeights),
        source: "fallback",
      }
    }

    // Build DNA from answers, but override the chosen archetype if Codex picked
    // something different from local resolution.
    const baseDna = buildStudyDna(answers)
    const dna: StudentDna = {
      ...baseDna,
      archetypeId: matched.id,
      trait: matched.name,
      tagline: matched.tagline,
      icon: matched.icon,
      isRare: !!matched.rare,
      rarity: matched.rarity ?? "Common",
      stats: matched.stats,
      aiPromptHint: matched.aiPromptHint,
      recommendedFeatures: matched.recommendedFeatures,
      sentimentAnchors: matched.sentimentAnchors,
      orbytAdapts: matched.orbytAdapts,
    }

    return {
      dna,
      cardWeights: normalizeWeights(parsed.cardWeights),
      source: "codex",
    }
  }
}
