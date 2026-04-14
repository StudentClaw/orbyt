import { Context, Effect, Layer } from "effect"
import { Schema } from "@effect/schema"
import {
  GatewayToolCallResult,
  GatewayToolInventoryReadResult,
  GatewayToolInventorySnapshot,
  GatewayToolsChangedEvent,
} from "@student-claw/contracts"
import { ConfigService } from "../config/ConfigService.js"

const EMPTY_SNAPSHOT: GatewayToolInventorySnapshot = {
  revision: 0,
  observedAt: new Date(0).toISOString(),
  tools: [],
}

const decodeGatewayToolInventoryReadResult = Schema.decodeUnknownSync(GatewayToolInventoryReadResult)
const decodeGatewayToolCallResult = Schema.decodeUnknownSync(GatewayToolCallResult)
const decodeGatewayToolsChangedEventEither = Schema.decodeUnknownEither(GatewayToolsChangedEvent)

export interface PluginGatewayService {
  readonly getInventory: () => Promise<GatewayToolInventorySnapshot>
  readonly callTool: (exposedToolName: string, args: Record<string, unknown>) => Promise<GatewayToolCallResult>
  readonly subscribeToolsChanged: (listener: (event: GatewayToolsChangedEvent) => void | Promise<void>) => () => void
  readonly dispose: () => Promise<void>
}

export class PluginGateway extends Context.Tag("PluginGateway")<
  PluginGateway,
  PluginGatewayService
>() {}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createAuthHeaders(token?: string): Record<string, string> {
  return token
    ? { authorization: `Bearer ${token}` }
    : {}
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  return text.length > 0 ? JSON.parse(text) : {}
}

async function* iterateSseMessages(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })

      while (true) {
        const boundary = buffer.indexOf("\n\n")
        if (boundary < 0) {
          break
        }

        const chunk = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        yield chunk
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function parseSseData(raw: string): string | null {
  const lines = raw.split("\n")
  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .join("\n")

  return data.length > 0 ? data : null
}

export const PluginGatewayLive = Layer.effect(
  PluginGateway,
  Effect.gen(function* () {
    const config = yield* ConfigService
    const listeners = new Set<(event: GatewayToolsChangedEvent) => void | Promise<void>>()
    const bridgeUrl = config.pluginGatewayBridgeUrl
    const eventsUrl = config.pluginGatewayBridgeEventsUrl ?? (bridgeUrl ? `${bridgeUrl}/events` : undefined)
    const authHeaders = createAuthHeaders(config.pluginGatewayBridgeToken)
    let cachedSnapshot = EMPTY_SNAPSHOT
    let disposed = false
    let eventsStarted = false
    let eventsAbortController: AbortController | null = null

    const getInventory = async (): Promise<GatewayToolInventorySnapshot> => {
      if (!bridgeUrl) {
        return cachedSnapshot
      }

      const response = await fetch(`${bridgeUrl}/tool-inventory`, {
        headers: authHeaders,
      })
      if (!response.ok) {
        throw new Error(`Plugin gateway inventory request failed (${response.status}).`)
      }

      const decoded = decodeGatewayToolInventoryReadResult(await readJson(response))
      cachedSnapshot = decoded.snapshot
      return cachedSnapshot
    }

    const callTool = async (
      exposedToolName: string,
      args: Record<string, unknown>,
    ): Promise<GatewayToolCallResult> => {
      if (!bridgeUrl) {
        return {
          ok: false,
          exposedToolName,
          reason: "tool_not_available",
          message: "Plugin gateway bridge is not configured.",
        }
      }

      const response = await fetch(`${bridgeUrl}/call-tool`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          exposedToolName,
          args,
        }),
      })

      if (!response.ok) {
        throw new Error(`Plugin gateway tool call failed (${response.status}).`)
      }

      const result = decodeGatewayToolCallResult(await readJson(response))
      return result
    }

    const notifyListeners = async (event: GatewayToolsChangedEvent): Promise<void> => {
      for (const listener of listeners) {
        await listener(event)
      }
    }

    const connectEvents = async (): Promise<void> => {
      if (!eventsUrl || eventsStarted) {
        return
      }

      eventsStarted = true

      while (!disposed) {
        const controller = new AbortController()
        eventsAbortController = controller

        try {
          const response = await fetch(eventsUrl, {
            headers: authHeaders,
            signal: controller.signal,
          })

          if (!response.ok || !response.body) {
            throw new Error(`Plugin gateway events request failed (${response.status}).`)
          }

          for await (const raw of iterateSseMessages(response.body)) {
            const payload = parseSseData(raw)
            if (!payload) {
              continue
            }

            const event = decodeGatewayToolsChangedEventEither(JSON.parse(payload))
            if (event._tag === "Left") {
              continue
            }

            cachedSnapshot = event.right.snapshot
            await notifyListeners(event.right)
          }
        } catch (error) {
          if (disposed || controller.signal.aborted) {
            break
          }

          await delay(500)
          continue
        } finally {
          if (eventsAbortController === controller) {
            eventsAbortController = null
          }
        }
      }
    }

    if (bridgeUrl) {
      void getInventory().catch(() => undefined)
      void connectEvents()
    }

    return {
      getInventory,
      callTool,
      subscribeToolsChanged: (listener) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
      dispose: async () => {
        disposed = true
        eventsAbortController?.abort()
        listeners.clear()
      },
    }
  }),
)
