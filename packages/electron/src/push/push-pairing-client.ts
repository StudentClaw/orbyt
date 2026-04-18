import type {
  PushPairingCompletion,
  PushPairingSession,
} from "@student-claw/contracts"

type FetchLike = typeof fetch

type PairingSessionResponse = {
  readonly sessionId: string
  readonly pairingUrl: string
  readonly expiresAt: string
  readonly state: PushPairingSession["state"]
}

type PairingStatusResponse = PairingSessionResponse & {
  readonly completion?: PushPairingCompletion
}

export class PushPairingClient {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  async createSession(relayBaseUrl: string, vapidPublicKey: string): Promise<PushPairingSession> {
    const response = await this.fetchImpl(`${relayBaseUrl}/api/pairing-sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        vapidPublicKey,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      }),
    })
    const payload = await response.json() as PairingSessionResponse

    return {
      sessionId: payload.sessionId,
      qrUrl: payload.pairingUrl,
      expiresAt: payload.expiresAt,
      state: payload.state,
    }
  }

  async getSessionStatus(
    relayBaseUrl: string,
    sessionId: string,
  ): Promise<{ session: PushPairingSession; completion: PushPairingCompletion | null }> {
    const response = await this.fetchImpl(`${relayBaseUrl}/api/pairing-sessions/${sessionId}`)
    const payload = await response.json() as PairingStatusResponse

    return {
      session: {
        sessionId: payload.sessionId,
        qrUrl: payload.pairingUrl,
        expiresAt: payload.expiresAt,
        state: payload.state,
      },
      completion: payload.completion ?? null,
    }
  }

  async cancelSession(relayBaseUrl: string, sessionId: string): Promise<void> {
    await this.fetchImpl(`${relayBaseUrl}/api/pairing-sessions/${sessionId}`, {
      method: "DELETE",
    })
  }
}
