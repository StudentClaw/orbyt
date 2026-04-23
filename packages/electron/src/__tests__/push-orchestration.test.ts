import { describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import path from "node:path"
import { tmpdir } from "node:os"
import type { PhonePushSettings, PushPairingCompletion } from "@orbyt/contracts"
import { PushStore } from "../push/push-store.js"
import {
  computeWeeklyInsightRunAt,
  WeeklyInsightScheduler,
} from "../push/weekly-insight-scheduler.js"
import { PushPairingClient } from "../push/push-pairing-client.js"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "orbyt-push-orchestration-"))
  tempDirs.push(dir)
  return dir
}

describe("PushPairingClient", () => {
  test("creates a pairing session and reads a completed subscription handoff", async () => {
    const calls: Array<{ url: string; method: string }> = []
    const completion: PushPairingCompletion = {
      platform: "ios",
      subscription: {
        endpoint: "https://example.com/subscription",
        expirationTime: null,
        keys: {
          p256dh: "p256dh-key",
          auth: "auth-key",
        },
      },
    }

    const client = new PushPairingClient(async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      calls.push({ url, method })

      if (method === "POST" && url.endsWith("/api/pairing-sessions")) {
        return new Response(JSON.stringify({
          sessionId: "session_1",
          pairingUrl: "https://push.example.com/pair/session_1",
          expiresAt: "2026-04-15T13:00:00.000Z",
          state: "pending",
        }), {
          headers: { "content-type": "application/json" },
        })
      }

      if (method === "GET" && url.endsWith("/api/pairing-sessions/session_1")) {
        return new Response(JSON.stringify({
          sessionId: "session_1",
          pairingUrl: "https://push.example.com/pair/session_1",
          expiresAt: "2026-04-15T13:00:00.000Z",
          state: "paired",
          completion,
        }), {
          headers: { "content-type": "application/json" },
        })
      }

      throw new Error(`Unexpected request: ${method} ${url}`)
    })

    const session = await client.createSession("https://push.example.com", "vapid-public-key")
    const status = await client.getSessionStatus("https://push.example.com", session.sessionId)

    expect(session).toMatchObject({
      sessionId: "session_1",
      qrUrl: "https://push.example.com/pair/session_1",
      state: "pending",
    })
    expect(status.completion).toEqual(completion)
    expect(calls).toEqual([
      { url: "https://push.example.com/api/pairing-sessions", method: "POST" },
      { url: "https://push.example.com/api/pairing-sessions/session_1", method: "GET" },
    ])
  })
})

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
    const store = new PushStore(path.join(root, "push-store.json"), {
      generateVapidKeys: () => ({
        publicKey: "public-key",
        privateKey: "private-key",
      }),
    })

    store.linkDevice({
      platform: "ios",
      subscription: {
        endpoint: "https://example.com/subscription",
        expirationTime: null,
        keys: {
          p256dh: "p256dh-key",
          auth: "auth-key",
        },
      },
    })

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
        send: async () => ({ ok: true, unlinkedDevice: false }),
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
})
