import { randomUUID } from "node:crypto"
import type { PushPairingCompletion } from "@student-claw/contracts"

type PairingSessionRecord = {
  readonly sessionId: string
  readonly pairingUrl: string
  readonly expiresAt: string
  readonly state: "pending" | "paired" | "expired" | "cancelled"
  readonly vapidPublicKey: string
  readonly completion: PushPairingCompletion | null
}

export interface PairingSessionStore {
  create: (record: PairingSessionRecord) => Promise<PairingSessionRecord>
  get: (sessionId: string) => Promise<PairingSessionRecord | null>
  put: (sessionId: string, record: PairingSessionRecord) => Promise<void>
  delete: (sessionId: string) => Promise<void>
}

export class InMemoryPairingSessionStore implements PairingSessionStore {
  private readonly records = new Map<string, PairingSessionRecord>()

  async create(record: PairingSessionRecord): Promise<PairingSessionRecord> {
    this.records.set(record.sessionId, record)
    return record
  }

  async get(sessionId: string): Promise<PairingSessionRecord | null> {
    return this.records.get(sessionId) ?? null
  }

  async put(sessionId: string, record: PairingSessionRecord): Promise<void> {
    this.records.set(sessionId, record)
  }

  async delete(sessionId: string): Promise<void> {
    this.records.delete(sessionId)
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })
}

function toState(record: PairingSessionRecord, now: Date): PairingSessionRecord {
  if (record.state === "pending" && new Date(record.expiresAt).getTime() <= now.getTime()) {
    return {
      ...record,
      state: "expired",
    }
  }

  return record
}

export function createPairingRelay(store: PairingSessionStore, now: () => Date = () => new Date()) {
  return {
    fetch: async (request: Request): Promise<Response> => {
      const url = new URL(request.url)
      const path = url.pathname

      if (request.method === "POST" && path === "/api/pairing-sessions") {
        const body = await request.json() as { vapidPublicKey: string; expiresAt: string }
        const sessionId = randomUUID()
        const record: PairingSessionRecord = {
          sessionId,
          pairingUrl: `${url.origin}/pair/${sessionId}`,
          expiresAt: body.expiresAt,
          state: "pending",
          vapidPublicKey: body.vapidPublicKey,
          completion: null,
        }

        await store.create(record)
        return json(record, 201)
      }

      const match = path.match(/^\/api\/pairing-sessions\/([^/]+)(\/complete)?$/)
      if (!match) {
        return json({ error: "not_found" }, 404)
      }

      const sessionId = match[1]
      if (!sessionId) {
        return json({ error: "not_found" }, 404)
      }
      const isComplete = Boolean(match[2])
      const existing = await store.get(sessionId)

      if (!existing) {
        return json({ error: "not_found" }, 404)
      }

      const current = toState(existing, now())
      if (current.state !== existing.state) {
        await store.put(sessionId, current)
      }

      if (request.method === "GET" && !isComplete) {
        return json(current)
      }

      if (request.method === "POST" && isComplete) {
        const completion = await request.json() as PushPairingCompletion
        const next = {
          ...current,
          state: "paired" as const,
          completion,
        }
        await store.put(sessionId, next)
        return json(next)
      }

      if (request.method === "DELETE" && !isComplete) {
        await store.delete(sessionId)
        return new Response(null, { status: 204 })
      }

      return json({ error: "method_not_allowed" }, 405)
    },
  }
}
