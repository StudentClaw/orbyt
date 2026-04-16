import { describe, expect, test } from "vitest"
import { completePhonePairing, detectPhonePlatform, requiresStandaloneInstall } from "./pwa"

describe("phone pairing PWA", () => {
  test("requires home-screen install on iPhone before push", () => {
    expect(requiresStandaloneInstall(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      false,
    )).toBe(true)
  })

  test("returns permission_denied when notification permission is rejected", async () => {
    const result = await completePhonePairing({
      sessionUrl: "https://push.example.com/api/pairing-sessions/session_1",
      userAgent: "Mozilla/5.0 (Android 14)",
      isStandalone: true,
      fetchImpl: async () => new Response(JSON.stringify({
        vapidPublicKey: "public-key",
      })) as never,
      requestPermission: async () => "denied",
      subscribe: async () => {
        throw new Error("should not subscribe")
      },
    })

    expect(result.status).toBe("permission_denied")
  })

  test("subscribes and posts the completion payload on success", async () => {
    const calls: Array<{ url: string; method: string }> = []

    const result = await completePhonePairing({
      sessionUrl: "https://push.example.com/api/pairing-sessions/session_1",
      userAgent: "Mozilla/5.0 (Android 14)",
      isStandalone: true,
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), method: init?.method ?? "GET" })
        if (!init?.method) {
          return new Response(JSON.stringify({
            vapidPublicKey: "public-key",
          })) as never
        }

        return new Response(JSON.stringify({ ok: true })) as never
      },
      requestPermission: async () => "granted",
      subscribe: async () => ({
        endpoint: "https://example.com/subscription",
        expirationTime: null,
        keys: {
          p256dh: "p256dh-key",
          auth: "auth-key",
        },
      }),
    })

    expect(result.status).toBe("paired")
    expect(detectPhonePlatform("Mozilla/5.0 (Android 14)")).toBe("android")
    expect(calls).toEqual([
      {
        url: "https://push.example.com/api/pairing-sessions/session_1",
        method: "GET",
      },
      {
        url: "https://push.example.com/api/pairing-sessions/session_1/complete",
        method: "POST",
      },
    ])
  })
})
