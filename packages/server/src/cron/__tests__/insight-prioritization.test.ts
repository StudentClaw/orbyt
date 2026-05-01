import { describe, test, expect } from "bun:test"
import {
  prioritizeCoursework,
  buildFallbackInsight,
} from "../insight-prioritization.js"
import type { UpcomingCourseworkRecord, RecapContext } from "../insight-context.js"

const DAY = 24 * 60 * 60 * 1000

const EMPTY_RECAP: RecapContext = {
  completedSessions: [],
  actedNotifications: [],
  submissionsToday: [],
}

function asg(
  overrides: Partial<UpcomingCourseworkRecord> & { itemId: string; title: string; dueAt: string | null },
): UpcomingCourseworkRecord {
  return {
    course: "CS101",
    assignmentType: "work",
    htmlUrl: null,
    ...overrides,
  }
}

describe("prioritizeCoursework", () => {
  test("assessments come before work, sorted by proximity", () => {
    const now = new Date("2026-04-29T08:00:00Z")
    const items: UpcomingCourseworkRecord[] = [
      asg({
        itemId: "hw",
        title: "HW 1",
        dueAt: new Date(now.getTime() + 1 * DAY).toISOString(),
        assignmentType: "work",
      }),
      asg({
        itemId: "quiz",
        title: "Quiz 4",
        dueAt: new Date(now.getTime() + 2 * DAY).toISOString(),
        assignmentType: "assessment",
      }),
    ]
    const out = prioritizeCoursework(items, now)
    expect(out.featured.map((i) => i.itemId)).toEqual(["quiz", "hw"])
  })

  test("work due within 3 days appears; work 4-7 days only if room", () => {
    const now = new Date("2026-04-29T08:00:00Z")
    const items: UpcomingCourseworkRecord[] = [
      asg({
        itemId: "near",
        title: "HW close",
        dueAt: new Date(now.getTime() + 2 * DAY).toISOString(),
      }),
      asg({
        itemId: "far",
        title: "HW far",
        dueAt: new Date(now.getTime() + 6 * DAY).toISOString(),
      }),
      asg({
        itemId: "exam",
        title: "Exam",
        assignmentType: "assessment",
        dueAt: new Date(now.getTime() + 5 * DAY).toISOString(),
      }),
    ]
    const out = prioritizeCoursework(items, now)
    expect(out.featured.map((i) => i.itemId)).toEqual(["exam", "near", "far"])
  })

  test("featured is capped at 3", () => {
    const now = new Date("2026-04-29T08:00:00Z")
    const items: UpcomingCourseworkRecord[] = []
    for (let i = 0; i < 6; i++) {
      items.push(
        asg({
          itemId: `q${i}`,
          title: `Quiz ${i}`,
          assignmentType: "assessment",
          dueAt: new Date(now.getTime() + (i + 1) * DAY).toISOString(),
        }),
      )
    }
    const out = prioritizeCoursework(items, now)
    expect(out.featured).toHaveLength(3)
  })

  test("passive items only featured if no assessments or close work", () => {
    const now = new Date("2026-04-29T08:00:00Z")
    const items: UpcomingCourseworkRecord[] = [
      asg({
        itemId: "read",
        title: "Pre-read",
        assignmentType: "passive",
        dueAt: new Date(now.getTime() + 2 * DAY).toISOString(),
      }),
    ]
    const out = prioritizeCoursework(items, now)
    expect(out.featured.map((i) => i.itemId)).toEqual(["read"])
    expect(out.isQuiet).toBe(true)
  })

  test("isQuiet=true when no assessments and no work-close", () => {
    const now = new Date("2026-04-29T08:00:00Z")
    const items: UpcomingCourseworkRecord[] = [
      asg({
        itemId: "far",
        title: "HW",
        dueAt: new Date(now.getTime() + 6 * DAY).toISOString(),
      }),
    ]
    expect(prioritizeCoursework(items, now).isQuiet).toBe(true)
  })

  test("isQuiet=false when assessments present", () => {
    const now = new Date("2026-04-29T08:00:00Z")
    const items: UpcomingCourseworkRecord[] = [
      asg({
        itemId: "ex",
        title: "Exam",
        assignmentType: "assessment",
        dueAt: new Date(now.getTime() + 5 * DAY).toISOString(),
      }),
    ]
    expect(prioritizeCoursework(items, now).isQuiet).toBe(false)
  })

  test("filters out items beyond 7 days and undated items", () => {
    const now = new Date("2026-04-29T08:00:00Z")
    const items: UpcomingCourseworkRecord[] = [
      asg({
        itemId: "way-out",
        title: "Way out",
        dueAt: new Date(now.getTime() + 10 * DAY).toISOString(),
      }),
      asg({ itemId: "no-date", title: "No date", dueAt: null }),
    ]
    expect(prioritizeCoursework(items, now).featured).toHaveLength(0)
  })
})

describe("buildFallbackInsight", () => {
  test("non-quiet morning: emits headline + bulleted items, never empty body", () => {
    const now = new Date("2026-04-29T08:00:00Z")
    const items: UpcomingCourseworkRecord[] = [
      asg({
        itemId: "hw",
        title: "HW 1",
        dueAt: new Date(now.getTime() + 2 * DAY).toISOString(),
      }),
      asg({
        itemId: "quiz",
        title: "Quiz 4",
        assignmentType: "assessment",
        dueAt: new Date(now.getTime() + 1 * DAY).toISOString(),
      }),
    ]
    const out = buildFallbackInsight(prioritizeCoursework(items, now), EMPTY_RECAP, "morning")
    expect(out.title.length).toBeGreaterThan(0)
    expect(out.title).not.toBe("daily-insight")
    expect(out.body).toContain("Quiz 4")
    expect(out.body).toContain("HW 1")
    expect(out.body.split("\n").length).toBeGreaterThanOrEqual(2)
  })

  test("evening with recap data: includes recap line", () => {
    const now = new Date("2026-04-29T19:00:00Z")
    const recap: RecapContext = {
      completedSessions: [
        {
          start: "2026-04-29T14:00:00Z",
          end: "2026-04-29T15:30:00Z",
          title: "PS6",
        },
      ],
      actedNotifications: [],
      submissionsToday: [{ course: "CHEM230", title: "Lab 4" }],
    }
    const out = buildFallbackInsight(
      prioritizeCoursework([], now),
      recap,
      "evening",
    )
    expect(out.body).toContain("session")
    expect(out.body).toContain("submission")
    expect(out.body).toContain("nice momentum")
  })

  test("quiet day: rest message + furthest item heads-up", () => {
    const now = new Date("2026-04-29T08:00:00Z")
    const items: UpcomingCourseworkRecord[] = [
      asg({
        itemId: "far",
        title: "Final Project",
        dueAt: new Date(now.getTime() + 9 * DAY).toISOString(),
      }),
    ]
    // 9 days out is beyond the 7-day window so prioritized.featured is empty
    // and isQuiet is true.
    const prioritized = prioritizeCoursework(items, now)
    expect(prioritized.featured).toHaveLength(0)
    expect(prioritized.isQuiet).toBe(true)
    const out = buildFallbackInsight(prioritized, EMPTY_RECAP, "morning")
    expect(out.title).not.toBe("daily-insight")
    expect(out.body.length).toBeGreaterThan(0)
    expect(out.body.toLowerCase()).toContain("breathing")
  })

  test("populates deepLink from the top featured item's htmlUrl", () => {
    const now = new Date("2026-04-29T08:00:00Z")
    const items: UpcomingCourseworkRecord[] = [
      asg({
        itemId: "x",
        title: "Quiz",
        assignmentType: "assessment",
        dueAt: new Date(now.getTime() + 1 * DAY).toISOString(),
        htmlUrl: "https://canvas.test/quiz",
      }),
    ]
    const out = buildFallbackInsight(
      prioritizeCoursework(items, now),
      EMPTY_RECAP,
      "morning",
    )
    expect(out.deepLink).toBe("https://canvas.test/quiz")
  })
})
