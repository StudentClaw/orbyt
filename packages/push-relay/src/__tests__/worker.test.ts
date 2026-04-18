import { describe, expect, test } from "bun:test"
import relayWorker, { PairingSessionDurableObject } from "../worker.js"

class FakeStorage {
  private readonly records = new Map<string, unknown>()

  async get<T>(key: string): Promise<T | undefined> {
    return this.records.get(key) as T | undefined
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.records.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this.records.delete(key)
  }
}

class FakeNamespace {
  private readonly instances = new Map<string, PairingSessionDurableObject>()

  idFromName(name: string): string {
    return name
  }

  get(id: unknown) {
    const key = String(id)
    let instance = this.instances.get(key)
    if (!instance) {
      instance = new PairingSessionDurableObject({
        storage: new FakeStorage(),
      })
      this.instances.set(key, instance)
    }

    return {
      fetch: (input: Request | string | URL, init?: RequestInit) => {
        const request = input instanceof Request
          ? input
          : new Request(input, init)

        return instance.fetch(request)
      },
    }
  }
}

describe("pairing relay worker", () => {
  test("routes session lifecycle through durable objects and uses the public pairing app base URL", async () => {
    const env = {
      PAIRING_APP_BASE_URL: "https://phone.example.com",
      PAIRING_SESSIONS: new FakeNamespace(),
    }

    const created = await relayWorker.fetch(new Request("https://api.example.com/api/pairing-sessions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        vapidPublicKey: "vapid-public-key",
        expiresAt: "2026-04-15T12:15:00.000Z",
      }),
    }), env)

    expect(created.status).toBe(201)
    const createdPayload = await created.json() as { sessionId: string; pairingUrl: string }
    expect(createdPayload.pairingUrl).toBe(`https://phone.example.com/pair/${createdPayload.sessionId}`)

    const fetched = await relayWorker.fetch(
      new Request(`https://api.example.com/api/pairing-sessions/${createdPayload.sessionId}`),
      env,
    )
    expect(fetched.status).toBe(200)

    const completed = await relayWorker.fetch(new Request(
      `https://api.example.com/api/pairing-sessions/${createdPayload.sessionId}/complete`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          platform: "ios",
          subscription: {
            endpoint: "https://push.example.com/subscription",
            expirationTime: null,
            keys: {
              p256dh: "p256dh-key",
              auth: "auth-key",
            },
          },
        }),
      },
    ), env)
    const completedPayload = await completed.json() as { state: string }
    expect(completedPayload.state).toBe("paired")

    const deleted = await relayWorker.fetch(
      new Request(`https://api.example.com/api/pairing-sessions/${createdPayload.sessionId}`, {
        method: "DELETE",
      }),
      env,
    )
    expect(deleted.status).toBe(204)

    const missing = await relayWorker.fetch(
      new Request(`https://api.example.com/api/pairing-sessions/${createdPayload.sessionId}`),
      env,
    )
    expect(missing.status).toBe(404)
  })
})
