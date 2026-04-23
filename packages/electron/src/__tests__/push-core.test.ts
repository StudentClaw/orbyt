import { afterEach, describe, expect, test } from "bun:test"
import { EventEmitter } from "node:events"
import { mkdtempSync, rmSync } from "node:fs"
import path from "node:path"
import { tmpdir } from "node:os"
import { PUSH_CHANNELS, type ActivityFeedEntry } from "@orbyt/contracts"
import { PushStore } from "../push/push-store.js"
import { PushDeliveryService } from "../push/push-delivery-service.js"
import { PushActivityBridge } from "../push/push-activity-bridge.js"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "orbyt-push-core-"))
  tempDirs.push(dir)
  return dir
}

class FakeWebSocket extends EventEmitter {
  close(): void {
    this.emit("close")
  }
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
  test("generates and reuses VAPID keys from disk", () => {
    const root = createTempDir()
    let generateCalls = 0

    const first = new PushStore(path.join(root, "push-store.json"), {
      generateVapidKeys: () => {
        generateCalls += 1
        return {
          publicKey: "public-key",
          privateKey: "private-key",
        }
      },
    })

    expect(first.getVapidKeys()).toEqual({
      publicKey: "public-key",
      privateKey: "private-key",
    })
    expect(generateCalls).toBe(1)

    const second = new PushStore(path.join(root, "push-store.json"), {
      generateVapidKeys: () => {
        throw new Error("should not regenerate")
      },
    })

    expect(second.getVapidKeys()).toEqual({
      publicKey: "public-key",
      privateKey: "private-key",
    })
    expect(generateCalls).toBe(1)
  })
})

describe("PushDeliveryService", () => {
  test("clears the linked device when the push endpoint is gone", async () => {
    const root = createTempDir()
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

    const service = new PushDeliveryService(store, {
      setVapidDetails: () => undefined,
      sendNotification: async () => {
        throw Object.assign(new Error("gone"), { statusCode: 410 })
      },
    })

    const result = await service.send({
      title: "Workflow complete",
      body: "The agent finished your task.",
    })

    expect(result).toEqual({ ok: false, unlinkedDevice: true })
    expect(store.getSettings().linkedDevice).toBeNull()
  })
})

describe("PushActivityBridge", () => {
  test("sends only high-priority activity feed events", async () => {
    const root = createTempDir()
    const store = new PushStore(path.join(root, "push-store.json"), {
      generateVapidKeys: () => ({
        publicKey: "public-key",
        privateKey: "private-key",
      }),
    })
    const socket = new FakeWebSocket()
    const sent: Array<{ title: string; body: string }> = []

    store.linkDevice({
      platform: "android",
      subscription: {
        endpoint: "https://example.com/subscription",
        expirationTime: null,
        keys: {
          p256dh: "p256dh-key",
          auth: "auth-key",
        },
      },
    })

    const bridge = new PushActivityBridge({
      wsUrl: "ws://127.0.0.1:8787",
      wsAuthToken: "a".repeat(64),
      store,
      delivery: {
        send: async (payload) => {
          sent.push(payload)
          return { ok: true, unlinkedDevice: false }
        },
      },
      now: () => new Date("2026-04-15T12:00:00.000Z"),
      webSocketFactory: () => socket as never,
    })

    bridge.start()

    const lowPriority: ActivityFeedEntry = {
      id: "activity_1" as ActivityFeedEntry["id"],
      category: "workflow",
      type: "workflow_completed",
      title: "Low priority",
      body: "Ignored",
      priority: 2,
    }
    const highPriority: ActivityFeedEntry = {
      id: "activity_2" as ActivityFeedEntry["id"],
      category: "workflow",
      type: "workflow_completed",
      title: "Workflow complete",
      body: "Sent",
      priority: 3,
    }

    socket.emit("message", JSON.stringify({
      kind: "push",
      channel: PUSH_CHANNELS.ACTIVITY_FEED,
      sequence: 1,
      data: lowPriority,
    }))
    socket.emit("message", JSON.stringify({
      kind: "push",
      channel: PUSH_CHANNELS.ACTIVITY_FEED,
      sequence: 2,
      data: highPriority,
    }))

    await Promise.resolve()

    expect(sent).toEqual([
      {
        title: "Workflow complete",
        body: "Sent",
        deepLink: undefined,
        tag: "workflow_completed",
      },
    ])

    bridge.stop()
  })
})
