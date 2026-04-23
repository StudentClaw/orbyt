import { createHash } from "node:crypto"
import { createId } from "@orbyt/shared-runtime"

export interface ParsedCandidate {
  readonly id: string
  readonly fingerprint: string
  readonly source: "daily" | "weekly"
  readonly branch: string
  readonly text: string
  readonly confidence: number
}

const CANDIDATE_RE =
  /^-\s+candidate:\s+"([^"]+)"\s+\(source:[^,)]+,\s+confidence:\s*([\d.]+)(?:,\s+branch:\s*([^)]+))?\)/gm

const LESSON_RE =
  /^-\s+lesson:\s+"([^"]+)"\s+\(confidence:\s*([\d.]+)(?:,\s+branch:\s*([^)]+))?\)/gm

export function candidateFingerprint(text: string): string {
  return createHash("sha256")
    .update(text.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32)
}

function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9/\-]/g, "")
}

function parseCandidatesFromContent(
  content: string,
  source: "daily" | "weekly",
  pattern: RegExp,
): ParsedCandidate[] {
  const results: ParsedCandidate[] = []
  let match: RegExpExecArray | null

  pattern.lastIndex = 0
  while ((match = pattern.exec(content)) !== null) {
    const text = match[1]!.trim()
    const confidence = parseFloat(match[2] ?? "0.5")
    const branch = normalizeSlug(match[3] ?? "school")
    results.push({
      id: createId("candidate"),
      fingerprint: candidateFingerprint(text),
      source,
      branch,
      text,
      confidence,
    })
  }

  return results
}

export function parseDailyCandidates(content: string): ParsedCandidate[] {
  return parseCandidatesFromContent(content, "daily", CANDIDATE_RE)
}

export function parseWeeklyCandidates(content: string): ParsedCandidate[] {
  return parseCandidatesFromContent(content, "weekly", LESSON_RE)
}
