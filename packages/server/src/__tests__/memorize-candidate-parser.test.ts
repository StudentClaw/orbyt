import { describe, test, expect } from "bun:test"
import {
  parseDailyCandidates,
  parseWeeklyCandidates,
  candidateFingerprint,
} from "../memory/candidate-parser.js"

describe("candidateFingerprint", () => {
  test("returns 32-char hex string", () => {
    const fp = candidateFingerprint("some fact")
    expect(fp).toHaveLength(32)
    expect(fp).toMatch(/^[0-9a-f]+$/)
  })

  test("is case-insensitive and trims whitespace", () => {
    expect(candidateFingerprint("Some Fact")).toBe(candidateFingerprint("some fact"))
    expect(candidateFingerprint("  some fact  ")).toBe(candidateFingerprint("some fact"))
  })

  test("is deterministic", () => {
    expect(candidateFingerprint("abc")).toBe(candidateFingerprint("abc"))
  })

  test("differs for different texts", () => {
    expect(candidateFingerprint("fact a")).not.toBe(candidateFingerprint("fact b"))
  })
})

describe("parseDailyCandidates", () => {
  test("parses a single candidate with branch", () => {
    const content = `- candidate: "Professor always posts grades within 48h" (source: conversation, confidence: 0.85, branch: school/courses/cs-301)`
    const result = parseDailyCandidates(content)
    expect(result).toHaveLength(1)
    expect(result[0]!.text).toBe("Professor always posts grades within 48h")
    expect(result[0]!.confidence).toBe(0.85)
    expect(result[0]!.branch).toBe("school/courses/cs-301")
    expect(result[0]!.source).toBe("daily")
  })

  test("defaults branch to 'school' when omitted", () => {
    const content = `- candidate: "Review Canvas before each class" (source: conversation, confidence: 0.7)`
    const result = parseDailyCandidates(content)
    expect(result).toHaveLength(1)
    expect(result[0]!.branch).toBe("school")
  })

  test("parses multiple candidates", () => {
    const content = [
      `- candidate: "Fact one" (source: conversation, confidence: 0.6, branch: school)`,
      `- candidate: "Fact two" (source: conversation, confidence: 0.9, branch: personality)`,
    ].join("\n")
    const result = parseDailyCandidates(content)
    expect(result).toHaveLength(2)
    expect(result[0]!.text).toBe("Fact one")
    expect(result[1]!.text).toBe("Fact two")
  })

  test("returns empty array when no candidates", () => {
    const content = "### Notable Events\n\n- something happened\n"
    expect(parseDailyCandidates(content)).toEqual([])
  })

  test("sets correct fingerprint on each candidate", () => {
    const content = `- candidate: "Stable fact" (source: conversation, confidence: 0.8, branch: school)`
    const result = parseDailyCandidates(content)
    expect(result[0]!.fingerprint).toBe(candidateFingerprint("Stable fact"))
  })

  test("assigns unique ids", () => {
    const content = [
      `- candidate: "Fact one" (source: conversation, confidence: 0.6, branch: school)`,
      `- candidate: "Fact two" (source: conversation, confidence: 0.6, branch: school)`,
    ].join("\n")
    const result = parseDailyCandidates(content)
    expect(result[0]!.id).not.toBe(result[1]!.id)
  })
})

describe("parseWeeklyCandidates", () => {
  test("parses a single lesson with branch", () => {
    const content = `- lesson: "Ask for rubric early in big projects" (confidence: 0.85, branch: school/playbooks/essays)`
    const result = parseWeeklyCandidates(content)
    expect(result).toHaveLength(1)
    expect(result[0]!.text).toBe("Ask for rubric early in big projects")
    expect(result[0]!.confidence).toBe(0.85)
    expect(result[0]!.branch).toBe("school/playbooks/essays")
    expect(result[0]!.source).toBe("weekly")
  })

  test("defaults branch to 'school' when omitted", () => {
    const content = `- lesson: "Start assignments early" (confidence: 0.8)`
    const result = parseWeeklyCandidates(content)
    expect(result[0]!.branch).toBe("school")
  })

  test("returns empty array when no lessons", () => {
    const content = "## Recurring Struggles\n\n- none\n"
    expect(parseWeeklyCandidates(content)).toEqual([])
  })

  test("sets source to 'weekly'", () => {
    const content = `- lesson: "Review notes same day" (confidence: 0.7, branch: routine)`
    const result = parseWeeklyCandidates(content)
    expect(result[0]!.source).toBe("weekly")
  })
})
