import { Context, Layer, Effect } from "effect"

export interface RuntimeReceiptBusService {
  readonly track: (commandId: string) => Promise<void>
  readonly resolve: (commandId: string, payload: unknown) => Promise<void>
  readonly waitFor: (commandId: string, timeoutMs?: number) => Promise<unknown>
}

export class RuntimeReceiptBus extends Context.Tag("RuntimeReceiptBus")<
  RuntimeReceiptBus,
  RuntimeReceiptBusService
>() {}

export const RuntimeReceiptBusLive = Layer.effect(
  RuntimeReceiptBus,
  Effect.sync(() => {
    const pending = new Map<string, { promise: Promise<unknown>; resolve: (value: unknown) => void }>()

    const ensurePending = (commandId: string) => {
      let entry = pending.get(commandId)
      if (entry) return entry

      let resolveValue: (value: unknown) => void = () => undefined
      const promise = new Promise<unknown>((resolve) => {
        resolveValue = resolve
      })
      entry = { promise, resolve: resolveValue }
      pending.set(commandId, entry)
      return entry
    }

    return {
      track: async (commandId) => {
        ensurePending(commandId)
      },
      resolve: async (commandId, payload) => {
        const entry = ensurePending(commandId)
        entry.resolve(payload)
        pending.delete(commandId)
      },
      waitFor: async (commandId, timeoutMs = 2_000) => {
        const entry = ensurePending(commandId)
        return Promise.race([
          entry.promise,
          new Promise<unknown>((_, reject) => {
            setTimeout(() => reject(new Error(`Timed out waiting for receipt ${commandId}`)), timeoutMs)
          }),
        ])
      },
    }
  }),
)
