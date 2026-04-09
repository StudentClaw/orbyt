import { Context, Layer, Effect } from "effect"

export interface ServerReadinessService {
  readonly awaitReady: () => Promise<void>
  readonly markReady: () => void
  readonly isReady: () => boolean
}

export class ServerReadiness extends Context.Tag("ServerReadiness")<
  ServerReadiness,
  ServerReadinessService
>() {}

export const ServerReadinessLive = Layer.effect(
  ServerReadiness,
  Effect.sync(() => {
    let ready = false
    let resolveReady: (() => void) | null = null
    const readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve
    })

    return {
      awaitReady: () => readyPromise,
      markReady: () => {
        if (ready) return
        ready = true
        resolveReady?.()
      },
      isReady: () => ready,
    }
  }),
)
