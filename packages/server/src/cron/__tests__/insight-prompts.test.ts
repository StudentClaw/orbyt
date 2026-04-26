import { describe, test, expect } from "bun:test"
import {
  buildDailyInsightPrompt,
  parseInsightOutput,
} from "../prompts.js"

describe("buildDailyInsightPrompt", () => {
  test("includes SOUL, recent insights, and reminder protocol", () => {
    const prompt = buildDailyInsightPrompt({
      soul: "Studies best in mornings.",
      nowIso: "2026-04-24T08:00:00.000Z",
      recentInsights: [
        {
          title: "Friday is light",
          body: "Move a session earlier",
          createdAt: "2026-04-23T19:00:00Z",
          actedOn: false,
        },
      ],
      upcomingCoursework: [
        { course: "CS101", title: "PA4", dueAt: "2026-04-26T23:59:00Z" },
      ],
      todaysSessions: [],
    })
    expect(prompt).toContain("INSIGHT:")
    expect(prompt).toContain("REMINDER:")
    expect(prompt).toContain("Studies best in mornings")
    expect(prompt).toContain("DISMISSED")
    expect(prompt).toContain("CS101: PA4")
  })

  test("renders empty sections with friendly fallbacks", () => {
    const prompt = buildDailyInsightPrompt({
      soul: "",
      nowIso: "now",
      recentInsights: [],
      upcomingCoursework: [],
      todaysSessions: [],
    })
    expect(prompt).toContain("(SOUL.md is empty)")
    expect(prompt).toContain("(no recent insights)")
    expect(prompt).toContain("(no upcoming items)")
    expect(prompt).toContain("(no sessions today)")
  })
})

describe("parseInsightOutput", () => {
  test("extracts insights and reminders", () => {
    const out = parseInsightOutput(
      [
        "INSIGHT: Friday is light | Consider moving Monday's review forward.",
        "INSIGHT: Calc midterm | Block 90 min Sunday.",
        "REMINDER: at=2026-04-25T14:00:00.000Z | Study Calc | Pull up problem set 4",
        "REMINDER: at=not-a-date | Bad | Bad",
      ].join("\n"),
    )
    expect(out.insights).toHaveLength(2)
    expect(out.insights[0]?.title).toBe("Friday is light")
    expect(out.reminders).toHaveLength(1)
    expect(out.reminders[0]?.title).toBe("Study Calc")
  })

  test("returns empty arrays when nothing matches", () => {
    const out = parseInsightOutput("just freeform text")
    expect(out.insights).toHaveLength(0)
    expect(out.reminders).toHaveLength(0)
  })
})
