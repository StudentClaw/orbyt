import { Context, Layer, Effect } from "effect"

export interface TurnCompletedPayload {
  readonly turnId: string
  readonly threadId: string
  readonly input: string
  readonly output: string
  readonly completedAt: string
}

export type TurnCompletedHandler = (
  payload: TurnCompletedPayload,
) => void | Promise<void>

export interface TurnEventBusService {
  readonly publishTurnCompleted: (payload: TurnCompletedPayload) => void
  readonly subscribeTurnCompleted: (handler: TurnCompletedHandler) => () => void
}

export class TurnEventBus extends Context.Tag("TurnEventBus")<
  TurnEventBus,
  TurnEventBusService
>() {}

export const TurnEventBusLive = Layer.effect(
  TurnEventBus,
  Effect.sync(() => {
    const handlers = new Set<TurnCompletedHandler>()

    return {
      publishTurnCompleted: (payload) => {
        for (const handler of handlers) {
          try {
            const result = handler(payload)
            if (result && typeof (result as Promise<void>).catch === "function") {
              ;(result as Promise<void>).catch((err: unknown) => {
                process.stderr.write(
                  `TurnEventBus handler error: ${String(err)}\n`,
                )
              })
            }
          } catch (err) {
            process.stderr.write(
              `TurnEventBus handler error: ${String(err)}\n`,
            )
          }
        }
      },
      subscribeTurnCompleted: (handler) => {
        handlers.add(handler)
        return () => {
          handlers.delete(handler)
        }
      },
    }
  }),
)
