import type { PushPairingCompletion } from "@orbyt/contracts"

type PairingSessionRecord = {
  readonly sessionId: string
  readonly pairingUrl: string
  readonly expiresAt: string
  readonly state: "pending" | "paired" | "expired" | "cancelled"
  readonly vapidPublicKey: string
  readonly completion: PushPairingCompletion | null
}

type DurableObjectStorageLike = {
  get: <T>(key: string) => Promise<T | undefined>
  put: <T>(key: string, value: T) => Promise<void>
  delete: (key: string) => Promise<void>
}

type DurableObjectStateLike = {
  readonly storage: DurableObjectStorageLike
}

type DurableObjectStubLike = {
  fetch: (request: Request | string | URL, init?: RequestInit) => Promise<Response>
}

type DurableObjectNamespaceLike = {
  idFromName: (name: string) => unknown
  get: (id: unknown) => DurableObjectStubLike
}

export type PairingRelayWorkerEnv = {
  readonly PAIRING_SESSIONS: DurableObjectNamespaceLike
  readonly PAIRING_APP_BASE_URL?: string
}

const RECORD_KEY = "pairing-session"

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

function buildPairingUrl(baseUrl: string, sessionId: string): string {
  return new URL(`/pair/${sessionId}`, baseUrl).toString()
}

function readSessionId(pathname: string): string | null {
  const match = pathname.match(/^\/api\/pairing-sessions\/([^/]+)(\/complete)?$/)
  return match?.[1] ?? null
}

async function cloneRequestForForwarding(request: Request): Promise<Request> {
  const body = request.method === "GET" || request.method === "DELETE"
    ? undefined
    : await request.clone().text()

  return new Request(`https://pairing-session.local${new URL(request.url).pathname}`, {
    method: request.method,
    headers: request.headers,
    body,
  })
}

async function getCurrentRecord(storage: DurableObjectStorageLike): Promise<PairingSessionRecord | null> {
  return await storage.get<PairingSessionRecord>(RECORD_KEY) ?? null
}

export class PairingSessionDurableObject {
  constructor(private readonly state: DurableObjectStateLike) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === "POST" && url.pathname === "/internal/create") {
      const record = await request.json() as PairingSessionRecord
      await this.state.storage.put(RECORD_KEY, record)
      return json(record, 201)
    }

    const currentRecord = await getCurrentRecord(this.state.storage)
    if (!currentRecord) {
      return json({ error: "not_found" }, 404)
    }

    const nextRecord = toState(currentRecord, new Date())
    if (nextRecord.state !== currentRecord.state) {
      await this.state.storage.put(RECORD_KEY, nextRecord)
    }

    if (request.method === "GET") {
      return json(nextRecord)
    }

    if (request.method === "POST" && url.pathname.endsWith("/complete")) {
      const completion = await request.json() as PushPairingCompletion
      const pairedRecord: PairingSessionRecord = {
        ...nextRecord,
        state: "paired",
        completion,
      }
      await this.state.storage.put(RECORD_KEY, pairedRecord)
      return json(pairedRecord)
    }

    if (request.method === "DELETE") {
      await this.state.storage.delete(RECORD_KEY)
      return new Response(null, { status: 204 })
    }

    return json({ error: "method_not_allowed" }, 405)
  }
}

const worker = {
  async fetch(request: Request, env: PairingRelayWorkerEnv): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === "POST" && url.pathname === "/api/pairing-sessions") {
      const body = await request.json() as { vapidPublicKey: string; expiresAt: string }
      const sessionId = crypto.randomUUID()
      const publicBaseUrl = env.PAIRING_APP_BASE_URL ?? url.origin
      const record: PairingSessionRecord = {
        sessionId,
        pairingUrl: buildPairingUrl(publicBaseUrl, sessionId),
        expiresAt: body.expiresAt,
        state: "pending",
        vapidPublicKey: body.vapidPublicKey,
        completion: null,
      }

      const stub = env.PAIRING_SESSIONS.get(env.PAIRING_SESSIONS.idFromName(sessionId))
      await stub.fetch(new Request("https://pairing-session.local/internal/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(record),
      }))

      return json(record, 201)
    }

    const sessionId = readSessionId(url.pathname)
    if (!sessionId) {
      return json({ error: "not_found" }, 404)
    }

    const stub = env.PAIRING_SESSIONS.get(env.PAIRING_SESSIONS.idFromName(sessionId))
    return stub.fetch(await cloneRequestForForwarding(request))
  },
}

export default worker
