import { describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import path from "node:path"
import { tmpdir } from "node:os"
import { PushStore } from "../push/push-store.js"
import {
  computeWeeklyInsightRunAt,
  WeeklyInsightScheduler,
} from "../push/weekly-insight-scheduler.js"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "orbyt-push-orchestration-"))
  tempDirs.push(dir)
  return dir
}

describe("WeeklyInsightScheduler", () => {
  test("computes the next scheduled weekly insight time in local time", () => {
    const runAt = computeWeeklyInsightRunAt(
      new Date("2026-04-15T12:00:00.000Z"),
      {
        weeklyInsightsDay: 1,
        weeklyInsightsTime: "08:00",
      },
    )

    expect(runAt.getDay()).toBe(1)
    expect(runAt.getHours()).toBe(8)
    expect(runAt.getMinutes()).toBe(0)
  })

  test("fires a missed weekly insight once on resume", async () => {
    const root = createTempDir()
    const sentWeekKeys: string[] = []
    const store = new PushStore(path.join(root, "push-store.json"))

    store.updateSettings({
      quietHoursStart: "22:00",
      quietHoursEnd: "23:00",
      weeklyInsightsDay: 1,
      weeklyInsightsTime: "08:00",
    })

    const scheduler = new WeeklyInsightScheduler({
      store,
      now: () => new Date("2026-04-15T12:00:00.000Z"),
      scheduleTimeout: (() => 1 as unknown as ReturnType<typeof setTimeout>),
      clearScheduledTimeout: () => undefined,
      fetchWeeklyInsight: async () => ({
        title: "Weekly insight ready",
        body: "This week you finished 3 workflows.",
        weekKey: "2026-04-13",
      }),
      delivery: {
        send: async () => ({ ok: true }),
      },
      onSent: (weekKey) => {
        sentWeekKeys.push(weekKey)
      },
    })

    await scheduler.runCatchUpIfNeeded()

    expect(sentWeekKeys).toEqual(["2026-04-13"])
    expect(store.getLastWeeklyInsightWeekKey()).toBe("2026-04-13")

    rmSync(root, { recursive: true, force: true })
  })

  test("skips delivery when notifications are disabled", async () => {
    const root = createTempDir()
    const sentWeekKeys: string[] = []
    const store = new PushStore(path.join(root, "push-store.json"))
    store.updateSettings({ enabled: false })

    const scheduler = new WeeklyInsightScheduler({
      store,
      now: () => new Date("2026-04-15T12:00:00.000Z"),
      scheduleTimeout: (() => 1 as unknown as ReturnType<typeof setTimeout>),
      clearScheduledTimeout: () => undefined,
      fetchWeeklyInsight: async () => ({
        title: "x",
        body: "x",
        weekKey: "2026-04-13",
      }),
      delivery: {
        send: async () => {
          sentWeekKeys.push("called")
          return { ok: true }
        },
      },
    })

    await scheduler.runCatchUpIfNeeded()
    expect(sentWeekKeys).toEqual([])

    rmSync(root, { recursive: true, force: true })
  })
})
