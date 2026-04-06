import { Schema } from "@effect/schema"
import { ClientMessage, ErrorEvent } from "@student-claw/shared"
import { handleHealthPing } from "./handlers/health.js"

export function routeMessage(raw: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return JSON.stringify(
      Schema.encodeSync(ErrorEvent)({
        event: "error" as const,
        data: { code: -32700, message: "Parse error: invalid JSON" },
      })
    )
  }

  const result = Schema.decodeUnknownEither(ClientMessage)(parsed)

  if (result._tag === "Left") {
    return JSON.stringify(
      Schema.encodeSync(ErrorEvent)({
        event: "error" as const,
        data: { code: -32600, message: "Invalid message: schema validation failed" },
      })
    )
  }

  const message = result.right

  switch (message.method) {
    case "health.ping":
      return handleHealthPing()
    default:
      return JSON.stringify(
        Schema.encodeSync(ErrorEvent)({
          event: "error" as const,
          data: {
            code: -32601,
            message: `Method not implemented: ${message.method}`,
          },
        })
      )
  }
}
