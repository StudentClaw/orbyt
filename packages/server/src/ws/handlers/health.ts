import { Schema } from "@effect/schema"
import { HealthPong } from "@orbyt/shared"

const startTime = Date.now()

export function handleHealthPing(): string {
  const event = Schema.encodeSync(HealthPong)({
    event: "health.pong" as const,
    data: { uptime: Date.now() - startTime },
  })
  return JSON.stringify(event)
}
