import { Context, Layer, Effect } from "effect"

/**
 * Tracks whether the local server runtime has finished bootstrapping.
 */
export interface ServerReadinessService {
  readonly awaitReady: () => Promise<void>
  readonly markReady: () => void
  readonly isReady: () => boolean
}

/**
 * Effect service tag for runtime readiness signaling.
 */
export class ServerReadiness extends Context.Tag("ServerReadiness")<
  ServerReadiness,
  ServerReadinessService
>() {}

/**
 * Provides in-memory readiness state for the server lifecycle stream.
 */
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
