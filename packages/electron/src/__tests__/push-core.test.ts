import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import path from "node:path"
import { tmpdir } from "node:os"
import { PushStore } from "../push/push-store.js"
import { PushDeliveryService } from "../push/push-delivery-service.js"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "orbyt-push-core-"))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe("PushStore", () => {
  test("persists default settings on first read and reloads them from disk", () => {
    const root = createTempDir()
    const filePath = path.join(root, "push-store.json")

    const first = new PushStore(filePath)
    expect(first.getSettings()).toMatchObject({
      enabled: true,
      weeklyInsightsEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      weeklyInsightsDay: 1,
      weeklyInsightsTime: "08:00",
    })

    const second = new PushStore(filePath)
    expect(second.getSettings()).toEqual(first.getSettings())
  })

  test("rejects a weekly insight time inside quiet hours", () => {
    const store = new PushStore(path.join(createTempDir(), "push-store.json"))
    expect(() =>
      store.updateSettings({
        quietHoursStart: "22:00",
        quietHoursEnd: "08:00",
        weeklyInsightsTime: "23:30",
      }),
    ).toThrow(/quiet hours/i)
  })

  test("remembers the last weekly insight week key", () => {
    const store = new PushStore(path.join(createTempDir(), "push-store.json"))
    expect(store.getLastWeeklyInsightWeekKey()).toBeNull()
    store.setLastWeeklyInsightWeekKey("2026-04-13")
    expect(store.getLastWeeklyInsightWeekKey()).toBe("2026-04-13")
  })
})

describe("PushDeliveryService", () => {
  test("returns ok=false when the OS does not support notifications", async () => {
    const service = new PushDeliveryService(
      () => ({ show: () => undefined }),
      () => false,
    )
    expect(await service.send({ title: "t", body: "b" })).toEqual({ ok: false })
  })

  test("shows a native notification when supported", async () => {
    let shown: { title: string; body: string } | null = null
    const service = new PushDeliveryService(
      (options) => ({
        show: () => {
          shown = options
        },
      }),
      () => true,
    )
    expect(await service.send({ title: "Weekly insight", body: "You finished 3 workflows." })).toEqual({
      ok: true,
    })
    expect(shown).toEqual({ title: "Weekly insight", body: "You finished 3 workflows." })
  })

  test("returns ok=false when the notification factory throws", async () => {
    const service = new PushDeliveryService(
      () => {
        throw new Error("boom")
      },
      () => true,
    )
    expect(await service.send({ title: "t", body: "b" })).toEqual({ ok: false })
  })
})
