import { describe, expect, test } from "bun:test"
import { createPairingRelay, InMemoryPairingSessionStore } from "../index.js"

describe("pairing relay", () => {
  test("creates, completes, fetches, and deletes pairing sessions", async () => {
    const relay = createPairingRelay(new InMemoryPairingSessionStore(), () => new Date("2026-04-15T12:00:00.000Z"))

    const created = await relay.fetch(new Request("https://push.example.com/api/pairing-sessions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        vapidPublicKey: "vapid-public-key",
        expiresAt: "2026-04-15T12:15:00.000Z",
      }),
    }))

    expect(created.status).toBe(201)
    const createdPayload = await created.json() as { sessionId: string; pairingUrl: string; state: string }
    expect(createdPayload.state).toBe("pending")

    const completed = await relay.fetch(new Request(`https://push.example.com/api/pairing-sessions/${createdPayload.sessionId}/complete`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        platform: "ios",
        subscription: {
          endpoint: "https://example.com/subscription",
          expirationTime: null,
          keys: {
            p256dh: "p256dh-key",
            auth: "auth-key",
          },
        },
      }),
    }))
    const completedPayload = await completed.json() as { state: string; completion: { platform: string } }
    expect(completedPayload.state).toBe("paired")
    expect(completedPayload.completion.platform).toBe("ios")

    const fetched = await relay.fetch(new Request(`https://push.example.com/api/pairing-sessions/${createdPayload.sessionId}`))
    const fetchedPayload = await fetched.json() as { state: string; completion: { platform: string } }
    expect(fetchedPayload.state).toBe("paired")
    expect(fetchedPayload.completion.platform).toBe("ios")

    const deleted = await relay.fetch(new Request(`https://push.example.com/api/pairing-sessions/${createdPayload.sessionId}`, {
      method: "DELETE",
    }))
    expect(deleted.status).toBe(204)
  })
})
