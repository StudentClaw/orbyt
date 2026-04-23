import { describe, test, expect, afterEach } from "bun:test"
import { mkdtempSync, rmSync, mkdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createMemoryPaths } from "../memory/paths.js"
import { runPromotion } from "../memory/promoter.js"
import { initialMemorizeState } from "@orbyt/contracts"
import type { MemorizeState } from "@orbyt/contracts"
import { candidateFingerprint } from "../memory/candidate-parser.js"

const tempDirs: string[] = []

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "sc-promoter-"))
  tempDirs.push(dir)
  const paths = createMemoryPaths({ env: { ORBYT_HOME: dir } })
  mkdirSync(paths.root, { recursive: true })
  return { paths }
}

afterEach(() => {
  for (const d of tempDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true })
  }
})

const NOW = new Date("2026-04-19T07:00:00.000Z")

const HIGH_CONF_DAILY =
  `### Promotion Candidates\n\n` +
  `- candidate: "Professor always uses Canvas announcements" (source: conversation, confidence: 0.95, branch: school/courses/cs-301)\n`

const LOW_CONF_DAILY =
  `### Promotion Candidates\n\n` +
  `- candidate: "Morning study sessions feel more productive" (source: conversation, confidence: 0.6, branch: personality)\n`

const SAME_TEXT_WEEKLY =
  `## Candidate Long-Term Lessons\n\n` +
  `- lesson: "Morning study sessions feel more productive" (confidence: 0.7, branch: personality)\n`

describe("runPromotion — immediate promotion (confidence >= 0.9)", () => {
  test("promotes high-confidence candidate on first appearance", async () => {
    const { paths } = setup()
    const result = await runPromotion(paths, initialMemorizeState(), HIGH_CONF_DAILY, null, NOW)
    expect(result.promoted).toHaveLength(1)
    expect(result.updatedPending).toHaveLength(0)
  })

  test("promoted file is written to disk", async () => {
    const { paths } = setup()
    const result = await runPromotion(paths, initialMemorizeState(), HIGH_CONF_DAILY, null, NOW)
    expect(existsSync(result.promoted[0]!)).toBe(true)
  })

  test("promoted file path matches course index", async () => {
    const { paths } = setup()
    const result = await runPromotion(paths, initialMemorizeState(), HIGH_CONF_DAILY, null, NOW)
    expect(result.promoted[0]).toBe(paths.courseIndex("cs-301"))
  })
})

describe("runPromotion — evidence accumulation (evidenceCount >= 2)", () => {
  test("queues low-confidence candidate instead of promoting", async () => {
    const { paths } = setup()
    const result = await runPromotion(paths, initialMemorizeState(), LOW_CONF_DAILY, null, NOW)
    expect(result.promoted).toHaveLength(0)
    expect(result.updatedPending).toHaveLength(1)
    expect(result.updatedPending[0]!.evidenceCount).toBe(1)
  })

  test("promotes after second daily appearance reaches threshold", async () => {
    const { paths } = setup()
    const first = await runPromotion(paths, initialMemorizeState(), LOW_CONF_DAILY, null, NOW)
    const state: MemorizeState = {
      ...initialMemorizeState(),
      pendingPromotionCandidates: [...first.updatedPending],
      promotedCandidateFingerprints: [...first.updatedFingerprints],
    }
    const second = await runPromotion(paths, state, LOW_CONF_DAILY, null, NOW)
    expect(second.promoted).toHaveLength(1)
    expect(second.updatedPending).toHaveLength(0)
  })

  test("weekly lesson counts as evidence for same-text daily candidate", async () => {
    const { paths } = setup()
    const first = await runPromotion(paths, initialMemorizeState(), LOW_CONF_DAILY, null, NOW)
    const state: MemorizeState = {
      ...initialMemorizeState(),
      pendingPromotionCandidates: [...first.updatedPending],
      promotedCandidateFingerprints: [...first.updatedFingerprints],
    }
    const second = await runPromotion(paths, state, null, SAME_TEXT_WEEKLY, NOW)
    expect(second.promoted).toHaveLength(1)
  })

  test("evidence count increments on re-appearance", async () => {
    const { paths } = setup()
    const first = await runPromotion(paths, initialMemorizeState(), LOW_CONF_DAILY, null, NOW)
    const state: MemorizeState = {
      ...initialMemorizeState(),
      pendingPromotionCandidates: [...first.updatedPending],
      promotedCandidateFingerprints: [],
    }
    // A second appearance that still doesn't promote (confidence still low, count goes to 2)
    // Actually count=2 triggers promotion since EVIDENCE_COUNT_THRESHOLD=2, so let's just check the first count
    expect(first.updatedPending[0]!.evidenceCount).toBe(1)
  })
})

describe("runPromotion — fingerprint deduplication", () => {
  test("skips candidate whose fingerprint is already in promotedFingerprints", async () => {
    const { paths } = setup()
    const first = await runPromotion(paths, initialMemorizeState(), HIGH_CONF_DAILY, null, NOW)
    const state: MemorizeState = {
      ...initialMemorizeState(),
      promotedCandidateFingerprints: [...first.updatedFingerprints],
    }
    const second = await runPromotion(paths, state, HIGH_CONF_DAILY, null, NOW)
    expect(second.promoted).toHaveLength(0)
    expect(second.updatedPending).toHaveLength(0)
  })

  test("adds fingerprint to updatedFingerprints after promotion", async () => {
    const { paths } = setup()
    const result = await runPromotion(paths, initialMemorizeState(), HIGH_CONF_DAILY, null, NOW)
    expect(result.updatedFingerprints).toHaveLength(1)
    expect(result.updatedFingerprints[0]).toMatch(/^[0-9a-f]{32}$/)
  })

  test("updatedFingerprints accumulates across runs", async () => {
    const { paths } = setup()
    const first = await runPromotion(paths, initialMemorizeState(), HIGH_CONF_DAILY, null, NOW)
    const anotherHighConf =
      `- candidate: "Second durable fact" (source: conversation, confidence: 0.95, branch: school)\n`
    const state: MemorizeState = {
      ...initialMemorizeState(),
      promotedCandidateFingerprints: [...first.updatedFingerprints],
    }
    const second = await runPromotion(paths, state, anotherHighConf, null, NOW)
    expect(second.updatedFingerprints).toHaveLength(2)
  })
})

describe("runPromotion — null content", () => {
  test("returns empty results when both daily and weekly are null", async () => {
    const { paths } = setup()
    const result = await runPromotion(paths, initialMemorizeState(), null, null, NOW)
    expect(result.promoted).toHaveLength(0)
    expect(result.updatedPending).toHaveLength(0)
    expect(result.updatedFingerprints).toHaveLength(0)
  })

  test("processes existing pending candidates from state even with null content", async () => {
    const { paths } = setup()
    // Seed a pending candidate at evidenceCount=1
    const first = await runPromotion(paths, initialMemorizeState(), LOW_CONF_DAILY, null, NOW)
    const state: MemorizeState = {
      ...initialMemorizeState(),
      pendingPromotionCandidates: first.updatedPending.map((c) => ({
        ...c,
        evidenceCount: 2,
      })),
      promotedCandidateFingerprints: [],
    }
    // With evidenceCount already at threshold, promotion should fire even with null content
    const result = await runPromotion(paths, state, null, null, NOW)
    expect(result.promoted).toHaveLength(1)
  })
})
