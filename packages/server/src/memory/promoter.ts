import { createId } from "@student-claw/shared-runtime"
import {
  EVIDENCE_COUNT_THRESHOLD,
  IMMEDIATE_PROMOTION_CONFIDENCE,
  type MemorizeState,
  type PromotionCandidate,
} from "@student-claw/contracts"
import {
  candidateFingerprint,
  parseDailyCandidates,
  parseWeeklyCandidates,
  type ParsedCandidate,
} from "./candidate-parser.js"
import { writeGraphCandidate } from "./graph-writer.js"
import type { MemoryPaths } from "./paths.js"

export interface PromotionResult {
  readonly promoted: string[]
  readonly updatedPending: readonly PromotionCandidate[]
  readonly updatedFingerprints: readonly string[]
}

function mergeIntoQueue(
  existing: readonly PromotionCandidate[],
  promotedFingerprints: readonly string[],
  incoming: readonly ParsedCandidate[],
  now: Date,
): readonly PromotionCandidate[] {
  const nowIso = now.toISOString()
  const queue: PromotionCandidate[] = existing.map((c) => ({ ...c }))

  for (const parsed of incoming) {
    if (promotedFingerprints.includes(parsed.fingerprint)) continue

    const idx = queue.findIndex((c) => candidateFingerprint(c.text) === parsed.fingerprint)
    if (idx >= 0) {
      const c = queue[idx]!
      queue[idx] = {
        ...c,
        evidenceCount: c.evidenceCount + 1,
        lastSeenAt: nowIso,
        confidence: parsed.confidence > c.confidence ? parsed.confidence : c.confidence,
      }
    } else {
      queue.push({
        id: createId("candidate"),
        source: parsed.source,
        branch: parsed.branch,
        text: parsed.text,
        confidence: parsed.confidence,
        firstSeenAt: nowIso,
        lastSeenAt: nowIso,
        evidenceCount: 1,
      })
    }
  }

  return queue
}

function shouldPromote(candidate: PromotionCandidate): boolean {
  return (
    candidate.confidence >= IMMEDIATE_PROMOTION_CONFIDENCE ||
    candidate.evidenceCount >= EVIDENCE_COUNT_THRESHOLD
  )
}

export async function runPromotion(
  paths: MemoryPaths,
  state: MemorizeState,
  dailyContent: string | null,
  weeklyContent: string | null,
  now: Date,
): Promise<PromotionResult> {
  const promotedFingerprints = state.promotedCandidateFingerprints ?? []
  const incoming: ParsedCandidate[] = []

  if (dailyContent) incoming.push(...parseDailyCandidates(dailyContent))
  if (weeklyContent) incoming.push(...parseWeeklyCandidates(weeklyContent))

  const queue = mergeIntoQueue(
    state.pendingPromotionCandidates,
    promotedFingerprints,
    incoming,
    now,
  )

  const promoted: string[] = []
  const newFingerprints = [...promotedFingerprints]
  const remaining: PromotionCandidate[] = []

  for (const candidate of queue) {
    if (shouldPromote(candidate)) {
      const filePath = writeGraphCandidate(paths, { ...candidate, fingerprint: candidateFingerprint(candidate.text) }, now)
      promoted.push(filePath)
      newFingerprints.push(candidateFingerprint(candidate.text))
    } else {
      remaining.push(candidate)
    }
  }

  return {
    promoted,
    updatedPending: remaining,
    updatedFingerprints: newFingerprints,
  }
}
