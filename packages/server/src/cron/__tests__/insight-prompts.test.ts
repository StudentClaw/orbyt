import { describe, test, expect } from "bun:test"
import {
  buildDailyInsightPrompt,
  buildEveningBriefingPrompt,
  buildMorningBriefingPrompt,
  parseEveningInsight,
  parseInsightOutput,
  parseMorningInsight,
} from "../prompts.js"
import type { UpcomingCourseworkRecord, RecapContext } from "../insight-context.js"

const EMPTY_RECAP: RecapContext = {
  completedSessions: [],
  actedNotifications: [],
  submissionsToday: [],
}

function asg(
  overrides: Partial<UpcomingCourseworkRecord> & { itemId: string; title: string },
): UpcomingCourseworkRecord {
  return {
    course: "CS101",
    dueAt: null,
    assignmentType: "work",
    htmlUrl: null,
    ...overrides,
  }
}

describe("buildDailyInsightPrompt", () => {
  test("evening slot includes recap framing", () => {
    const prompt = buildDailyInsightPrompt({
      soul: "",
      nowIso: "2026-04-24T19:00:00.000Z",
      slot: "evening",
      recentInsights: [],
      upcomingCoursework: [],
      todaysSessions: [],
      recap: EMPTY_RECAP,
    })
    expect(prompt).toContain("EVENING")
    expect(prompt).toContain("RECAP")
    expect(prompt).toContain("encouragement")
    expect(prompt).toContain("(SOUL.md is empty)")
    expect(prompt).toContain("(no recent insights)")
    expect(prompt).toContain("(no upcoming items in the next 7 days)")
    expect(prompt).toContain("(no sessions today)")
    expect(prompt).toContain("(nothing logged today yet)")
  })

  test("renders coursework items with their assignment_type label", () => {
    const prompt = buildDailyInsightPrompt({
      soul: "",
      nowIso: "now",
      slot: "evening",
      recentInsights: [],
      upcomingCoursework: [
        asg({
          itemId: "a",
          title: "Calc Midterm",
          assignmentType: "assessment",
          dueAt: "2026-05-01T09:00:00Z",
        }),
        asg({
          itemId: "b",
          title: "HW 7",
          assignmentType: "work",
          dueAt: "2026-04-30T17:00:00Z",
        }),
        asg({
          itemId: "c",
          title: "Pre-reading: Ch 3",
          assignmentType: "passive",
          dueAt: "2026-04-26T08:00:00Z",
        }),
      ],
      todaysSessions: [],
      recap: EMPTY_RECAP,
    })
    expect(prompt).toContain("[assessment]")
    expect(prompt).toContain("[work]")
    expect(prompt).toContain("[passive]")
    expect(prompt).toContain("Calc Midterm")
  })

  test("recap section includes sessions, acted notifications, and submissions", () => {
    const prompt = buildDailyInsightPrompt({
      soul: "",
      nowIso: "2026-04-29T19:00:00.000Z",
      slot: "evening",
      recentInsights: [],
      upcomingCoursework: [],
      todaysSessions: [],
      recap: {
        completedSessions: [
          {
            start: "2026-04-29T14:00:00Z",
            end: "2026-04-29T15:30:00Z",
            title: "Calc PS6",
          },
        ],
        actedNotifications: [
          {
            category: "cron",
            type: "heartbeat.alert",
            title: "Calc HW",
            body: null,
            actedAtMs: Date.now(),
          },
        ],
        submissionsToday: [{ course: "CHEM230", title: "Lab 4 report" }],
      },
    })
    expect(prompt).toContain("Calc PS6")
    expect(prompt).toContain("Notifications acted on today: 1")
    expect(prompt).toContain("CHEM230: Lab 4 report")
  })
})

describe("buildMorningBriefingPrompt", () => {
  test("briefing mode contains the four-component instructions and JSON example", () => {
    const prompt = buildMorningBriefingPrompt({
      soul: "Studies best in mornings.",
      nowIso: "2026-04-24T08:00:00.000Z",
      slot: "morning",
      mode: "briefing",
      mustDoToday: [
        asg({ itemId: "a", title: "PA4", dueAt: "2026-04-24T23:59:00Z" }),
      ],
      recentInsights: [
        {
          title: "Friday is light",
          body: "Move a session earlier",
          createdAt: "2026-04-23T19:00:00Z",
          actedOn: false,
        },
      ],
      upcomingCoursework: [
        asg({ itemId: "a", title: "PA4", dueAt: "2026-04-24T23:59:00Z" }),
      ],
      todaysSessions: [],
      recap: EMPTY_RECAP,
    })
    expect(prompt).toContain("MODE: BRIEFING")
    expect(prompt).toContain("INSIGHT_JSON:")
    expect(prompt).toContain("anchor")
    expect(prompt).toContain("mustDo")
    expect(prompt).toContain("lever")
    expect(prompt).toContain("horizon")
    expect(prompt).toContain("NEVER use emoji")
    expect(prompt).toContain("Studies best in mornings")
    expect(prompt).toContain("DISMISSED")
    expect(prompt).toContain('"mode":"briefing"')
  })

  test("quiet mode swaps in reflective/seed guidance and quiet-shape example", () => {
    const prompt = buildMorningBriefingPrompt({
      soul: "",
      nowIso: "2026-05-04T08:00:00.000Z",
      slot: "morning",
      mode: "quiet",
      mustDoToday: [],
      recentInsights: [],
      upcomingCoursework: [],
      todaysSessions: [],
      recap: EMPTY_RECAP,
    })
    expect(prompt).toContain("MODE: QUIET")
    expect(prompt).toContain("REFLECTIVE")
    expect(prompt).toContain("SEED")
    expect(prompt).toContain('"mode":"quiet"')
    expect(prompt).not.toContain("MODE: BRIEFING")
  })
})

describe("parseMorningInsight", () => {
  test("parses a valid briefing payload", () => {
    const reply = `INSIGHT_JSON: {"mode":"briefing","headline":"Calc midterm in 3 days, Lab due tonight","anchor":"Tuesday — 3 classes, 1 block","mustDo":[{"course":"CS38","title":"CW Array1","dueTime":"2026-04-30T23:59:00Z","deepLink":"https://canvas/x"}],"lever":"Best move today is 45min on Calc Ch 5.","horizon":"Big rock: PHYS midterm Thursday"}
REMINDER: at=2026-04-30T19:00:00Z | Calc review | Pull up Ch 5`
    const out = parseMorningInsight(reply)
    expect(out.payload).not.toBeNull()
    expect(out.payload?.mode).toBe("briefing")
    if (out.payload?.mode === "briefing") {
      expect(out.payload.headline).toContain("Calc midterm")
      expect(out.payload.mustDo).toHaveLength(1)
      expect(out.payload.mustDo[0]?.course).toBe("CS38")
      expect(out.payload.horizon).toContain("PHYS midterm")
    }
    expect(out.reminders).toHaveLength(1)
  })

  test("parses a valid quiet payload with null reflection", () => {
    const reply = `INSIGHT_JSON: {"mode":"quiet","headline":"Quiet morning","lever":"Use the breathing room.","reflection":null}`
    const out = parseMorningInsight(reply)
    expect(out.payload?.mode).toBe("quiet")
    if (out.payload?.mode === "quiet") {
      expect(out.payload.reflection).toBeNull()
    }
  })

  test("strips emoji defensively from any model output", () => {
    const reply = `INSIGHT_JSON: {"mode":"quiet","headline":"☀ Quiet morning 🪐","lever":"⏰ Use the breathing room.","reflection":null}`
    const out = parseMorningInsight(reply)
    expect(out.payload?.headline ?? "").not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
    expect(out.payload?.lever ?? "").not.toMatch(/[☀-➿]/u)
  })

  test("returns null payload on malformed JSON", () => {
    const out = parseMorningInsight("INSIGHT_JSON: {not really json}")
    expect(out.payload).toBeNull()
  })

  test("returns null payload when mode is missing or unknown", () => {
    const a = parseMorningInsight(`INSIGHT_JSON: {"headline":"x","lever":"y"}`)
    expect(a.payload).toBeNull()
    const b = parseMorningInsight(
      `INSIGHT_JSON: {"mode":"weekly","headline":"x","lever":"y"}`,
    )
    expect(b.payload).toBeNull()
  })

  test("rejects briefing payloads that drop required anchor", () => {
    const out = parseMorningInsight(
      `INSIGHT_JSON: {"mode":"briefing","headline":"x","mustDo":[],"lever":"y","horizon":null}`,
    )
    expect(out.payload).toBeNull()
  })
})

describe("buildEveningBriefingPrompt", () => {
  test("briefing mode mentions four components and a slot:evening JSON example", () => {
    const prompt = buildEveningBriefingPrompt({
      soul: "Studies best in mornings.",
      nowIso: "2026-04-29T19:00:00.000Z",
      slot: "evening",
      mode: "briefing",
      recapItems: [
        { kind: "session", course: "CALC", label: "2hr Calc PS6" },
        { kind: "submission", course: "CHEM230", label: "Lab 4 report" },
        { kind: "acted_summary", course: null, label: "3 reminders acted" },
      ],
      recentInsights: [],
      upcomingCoursework: [],
      todaysSessions: [],
      recap: EMPTY_RECAP,
    })
    expect(prompt).toContain("MODE: BRIEFING")
    expect(prompt).toContain("recap.summary")
    expect(prompt).toContain("throughline")
    expect(prompt).toContain("tomorrow")
    expect(prompt).toContain("windDown")
    expect(prompt).toContain("CROSS-TEMPORAL")
    expect(prompt).toContain('"slot":"evening"')
    expect(prompt).toContain("kind=session")
    expect(prompt).toContain("kind=submission")
    expect(prompt).toContain("kind=acted_summary")
  })

  test("quiet mode keeps the throughline and drops briefing-only fields", () => {
    const prompt = buildEveningBriefingPrompt({
      soul: "",
      nowIso: "2026-04-29T19:00:00.000Z",
      slot: "evening",
      mode: "quiet",
      recapItems: [],
      recentInsights: [],
      upcomingCoursework: [],
      todaysSessions: [],
      recap: EMPTY_RECAP,
    })
    expect(prompt).toContain("MODE: QUIET")
    expect(prompt).toContain("throughline")
    expect(prompt).toContain('"mode":"quiet"')
    expect(prompt).not.toContain("MODE: BRIEFING")
  })
})

describe("parseEveningInsight", () => {
  test("parses a valid briefing payload with recap items", () => {
    const reply = `INSIGHT_JSON: {"slot":"evening","mode":"briefing","headline":"Solid grind","recap":{"summary":"You stuck the Calc landing.","items":[{"kind":"session","course":"CALC","label":"2hr Calc PS6"},{"kind":"acted_summary","course":null,"label":"3 reminders acted"}]},"throughline":"Three of your last four shipped items were morning sessions.","tomorrow":"Tomorrow leans heavy.","windDown":"Brain can let go now."}`
    const out = parseEveningInsight(reply)
    expect(out.payload).not.toBeNull()
    expect(out.payload?.mode).toBe("briefing")
    if (out.payload?.mode === "briefing") {
      expect(out.payload.recap.items).toHaveLength(2)
      expect(out.payload.recap.items[0]?.kind).toBe("session")
      expect(out.payload.windDown).toContain("Brain can let go")
      expect(out.payload.slot).toBe("evening")
    }
  })

  test("parses a valid quiet payload", () => {
    const reply = `INSIGHT_JSON: {"slot":"evening","mode":"quiet","headline":"Quiet evening","throughline":"Mornings are working.","reflection":null}`
    const out = parseEveningInsight(reply)
    expect(out.payload?.mode).toBe("quiet")
    if (out.payload?.mode === "quiet") {
      expect(out.payload.reflection).toBeNull()
    }
  })

  test("rejects payloads with the wrong slot", () => {
    const out = parseEveningInsight(
      `INSIGHT_JSON: {"slot":"morning","mode":"quiet","headline":"x","throughline":"y","reflection":null}`,
    )
    expect(out.payload).toBeNull()
  })

  test("rejects briefing payloads missing recap.summary", () => {
    const out = parseEveningInsight(
      `INSIGHT_JSON: {"slot":"evening","mode":"briefing","headline":"x","recap":{"items":[]},"throughline":"y","tomorrow":"z","windDown":null}`,
    )
    expect(out.payload).toBeNull()
  })

  test("drops recap items with unknown kind", () => {
    const reply = `INSIGHT_JSON: {"slot":"evening","mode":"briefing","headline":"x","recap":{"summary":"s","items":[{"kind":"weird","label":"oops"},{"kind":"session","course":"CS","label":"30min"}]},"throughline":"t","tomorrow":"to","windDown":null}`
    const out = parseEveningInsight(reply)
    if (out.payload?.mode === "briefing") {
      expect(out.payload.recap.items).toHaveLength(1)
      expect(out.payload.recap.items[0]?.kind).toBe("session")
    }
  })

  test("strips emoji defensively from any model output", () => {
    const reply = `INSIGHT_JSON: {"slot":"evening","mode":"quiet","headline":"☀ Quiet evening 🪐","throughline":"⏰ pattern","reflection":null}`
    const out = parseEveningInsight(reply)
    expect(out.payload?.headline ?? "").not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
    expect(out.payload?.headline ?? "").not.toMatch(/[\u{2600}-\u{27BF}]/u)
  })

  test("returns null on malformed JSON", () => {
    const out = parseEveningInsight("INSIGHT_JSON: {not really json}")
    expect(out.payload).toBeNull()
  })
})

describe("parseInsightOutput", () => {
  test("extracts a single multi-line INSIGHT and reminders", () => {
    const out = parseInsightOutput(
      [
        "INSIGHT: Calc midterm in 2 days | ⚠ Calc midterm Wed 9am — block 2 review sessions",
        "⏰ CHEM 230 Quiz tomorrow 2pm",
        "📝 HW 7 due Friday 5pm",
        "REMINDER: at=2026-04-25T14:00:00.000Z | Study Calc | Pull up problem set 4",
        "REMINDER: at=not-a-date | Bad | Bad",
      ].join("\n"),
    )
    expect(out.insights).toHaveLength(1)
    expect(out.insights[0]?.title).toBe("Calc midterm in 2 days")
    expect(out.insights[0]?.body).toContain("Calc midterm Wed 9am")
    expect(out.insights[0]?.body).toContain("HW 7 due Friday 5pm")
    expect(out.reminders).toHaveLength(1)
    expect(out.reminders[0]?.title).toBe("Study Calc")
  })

  test("returns empty arrays when nothing matches", () => {
    const out = parseInsightOutput("just freeform text")
    expect(out.insights).toHaveLength(0)
    expect(out.reminders).toHaveLength(0)
  })

  test("INSIGHT with single-line body still parses", () => {
    const out = parseInsightOutput(
      "INSIGHT: Quiet week ahead | No deadlines in the next 4 days. Use the breathing room.",
    )
    expect(out.insights).toHaveLength(1)
    expect(out.insights[0]?.title).toBe("Quiet week ahead")
    expect(out.insights[0]?.body).toBe(
      "No deadlines in the next 4 days. Use the breathing room.",
    )
  })
})
