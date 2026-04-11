import type { IncomingMessage } from "node:http"
import { WS_PROTOCOL } from "@student-claw/contracts"

const AUTH_PROTOCOL_PREFIX = "auth."

type HandshakeConfig = {
  readonly allowedOrigins: readonly string[]
  readonly expectedAuthToken: string
}

/**
 * Result returned after validating the requested origin and auth subprotocols.
 */
export type HandshakeValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string }

function parseHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function parseRequestedProtocols(request: IncomingMessage): string[] {
  return parseHeaderValue(request.headers["sec-websocket-protocol"])
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean) ?? []
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin)
    return hostname === "localhost" || hostname === "127.0.0.1"
  } catch {
    return false
  }
}

function isAllowedOrigin(origin: string | undefined, allowedOrigins: readonly string[]): boolean {
  if (!origin || origin === "null") return true
  if (allowedOrigins.includes(origin)) return true
  return isLocalhostOrigin(origin)
}

/**
 * Validates the incoming WebSocket upgrade request against the local runtime trust boundary.
 */
export function validateWebSocketHandshake(
  request: IncomingMessage,
  config: HandshakeConfig,
): HandshakeValidationResult {
  const origin = parseHeaderValue(request.headers.origin)
  if (!isAllowedOrigin(origin, config.allowedOrigins)) {
    return { ok: false, reason: "Unexpected origin" }
  }

  const protocols = parseRequestedProtocols(request)
  if (!protocols.includes(WS_PROTOCOL)) {
    return { ok: false, reason: "Missing Student Claw protocol" }
  }

  const authProtocol = `${AUTH_PROTOCOL_PREFIX}${config.expectedAuthToken}`
  if (!protocols.includes(authProtocol)) {
    return { ok: false, reason: "Missing auth protocol" }
  }

  return { ok: true }
}

/**
 * Selects the single supported Student Claw WebSocket subprotocol.
 */
export function selectWebSocketProtocol(protocols: Set<string>): string | false {
  return protocols.has(WS_PROTOCOL) ? WS_PROTOCOL : false
}
