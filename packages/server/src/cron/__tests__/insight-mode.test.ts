import { describe, test, expect } from "bun:test"
import {
  buildEveningRecapItems,
  detectEveningMode,
  detectMorningMode,
  todayMustDo,
} from "../insight-mode.js"
import type { InsightContext, UpcomingCourseworkRecord } from "../insight-context.js"

const NOW = new Date("2026-04-29T08:00:00.000Z")

function emptyContext(): InsightContext {
  return {
    recentInsights: [],
    upcomingCoursework: [],
    todaysSessions: [],
    recap: {
      completedSessions: [],
      actedNotifications: [],
      submissionsToday: [],
    },
  }
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

describe("detectMorningMode", () => {
  test("returns 'quiet' on a fully empty context", () => {
    expect(detectMorningMode(emptyContext(), NOW)).toBe("quiet")
  })

  test("returns 'briefing' when something is due today", () => {
    const ctx = emptyContext()
    const dueToday = asg({
      itemId: "a",
      title: "PA4",
      dueAt: "2026-04-29T17:00:00Z",
    })
    expect(
      detectMorningMode(
        { ...ctx, upcomingCoursework: [dueToday] },
        NOW,
      ),
    ).toBe("briefing")
  })

  test("returns 'briefing' when a planned block exists today", () => {
    const ctx = emptyContext()
    expect(
      detectMorningMode(
        {
          ...ctx,
          todaysSessions: [
            {
              start: "2026-04-29T14:00:00Z",
              end: "2026-04-29T15:00:00Z",
              title: "Calc PS6",
            },
          ],
        },
        NOW,
      ),
    ).toBe("briefing")
  })

  test("returns 'briefing' when an item is due within 48h", () => {
    const ctx = emptyContext()
    const dueTomorrow = asg({
      itemId: "b",
      title: "HW 7",
      dueAt: "2026-04-30T15:00:00Z",
    })
    expect(
      detectMorningMode(
        { ...ctx, upcomingCoursework: [dueTomorrow] },
        NOW,
      ),
    ).toBe("briefing")
  })

  test("ignores far-future items (>48h) for the near-horizon signal", () => {
    const ctx = emptyContext()
    const far = asg({
      itemId: "c",
      title: "Project",
      dueAt: "2026-05-05T17:00:00Z",
    })
    expect(
      detectMorningMode(
        { ...ctx, upcomingCoursework: [far] },
        NOW,
      ),
    ).toBe("quiet")
  })

  test("treats already-logged work today as briefing-worthy", () => {
    const ctx = emptyContext()
    expect(
      detectMorningMode(
        {
          ...ctx,
          recap: {
            completedSessions: [],
            actedNotifications: [],
            submissionsToday: [{ course: "CHEM230", title: "Lab 4" }],
          },
        },
        NOW,
      ),
    ).toBe("briefing")
  })
})

describe("detectEveningMode", () => {
  test("returns 'quiet' on a fully empty context", () => {
    expect(detectEveningMode(emptyContext(), NOW)).toBe("quiet")
  })

  test("returns 'briefing' when sessions or submissions logged today", () => {
    const ctx = emptyContext()
    expect(
      detectEveningMode(
        {
          ...ctx,
          recap: {
            completedSessions: [],
            actedNotifications: [],
            submissionsToday: [{ course: "CHEM230", title: "Lab 4" }],
          },
        },
        NOW,
      ),
    ).toBe("briefing")
  })

  test("returns 'briefing' when an item is due within 24h tomorrow", () => {
    const ctx = emptyContext()
    expect(
      detectEveningMode(
        {
          ...ctx,
          upcomingCoursework: [
            asg({
              itemId: "z",
              title: "Quiz 3",
              assignmentType: "assessment",
              dueAt: "2026-04-30T07:00:00Z",
            }),
          ],
        },
        NOW,
      ),
    ).toBe("briefing")
  })

  test("ignores items >24h out for the near-tomorrow signal", () => {
    const ctx = emptyContext()
    expect(
      detectEveningMode(
        {
          ...ctx,
          upcomingCoursework: [
            asg({
              itemId: "f",
              title: "Project",
              dueAt: "2026-05-05T17:00:00Z",
            }),
          ],
        },
        NOW,
      ),
    ).toBe("quiet")
  })
})

describe("buildEveningRecapItems", () => {
  test("emits a session chip with hour-formatted label", () => {
    const items = buildEveningRecapItems({
      completedSessions: [
        {
          start: "2026-04-29T14:00:00Z",
          end: "2026-04-29T16:00:00Z",
          title: "Calc PS6",
        },
      ],
      actedNotifications: [],
      submissionsToday: [],
    })
    expect(items).toHaveLength(1)
    expect(items[0]?.kind).toBe("session")
    expect(items[0]?.label).toBe("2hr Calc PS6")
  })

  test("collapses acted notifications into a single aggregated chip", () => {
    const items = buildEveningRecapItems({
      completedSessions: [],
      actedNotifications: [
        { category: "cron", type: "x", title: "a", body: null, actedAtMs: 1 },
        { category: "cron", type: "x", title: "b", body: null, actedAtMs: 2 },
        { category: "cron", type: "x", title: "c", body: null, actedAtMs: 3 },
      ],
      submissionsToday: [],
    })
    expect(items).toHaveLength(1)
    expect(items[0]?.kind).toBe("acted_summary")
    expect(items[0]?.label).toBe("3 reminders acted")
  })

  test("simplifies long course codes on submission chips", () => {
    const items = buildEveningRecapItems({
      completedSessions: [],
      actedNotifications: [],
      submissionsToday: [
        { course: "2025FA_CS38_INTRO_PROGRAMMING", title: "PA4" },
      ],
    })
    expect(items[0]?.course).toBe("CS38")
  })
})

describe("todayMustDo", () => {
  test("includes only items due in today's local-day window", () => {
    const due = asg({
      itemId: "a",
      title: "PA4",
      dueAt: "2026-04-29T17:00:00Z",
    })
    const tomorrow = asg({
      itemId: "b",
      title: "HW",
      dueAt: "2026-04-30T17:00:00Z",
    })
    const out = todayMustDo([due, tomorrow], NOW)
    expect(out).toHaveLength(1)
    expect(out[0]?.itemId).toBe("a")
  })

  test("excludes passive items (reading/discussion) even if dated today", () => {
    const reading = asg({
      itemId: "r",
      title: "Read Ch 3",
      assignmentType: "passive",
      dueAt: "2026-04-29T23:59:00Z",
    })
    expect(todayMustDo([reading], NOW)).toHaveLength(0)
  })
})
