import { Context, Effect, Layer } from "effect"
import type { MemorizeRunResult } from "@student-claw/contracts"
import { ConfigService } from "../config/ConfigService.js"
import { Database } from "../db/Database.js"
import { CodexCli } from "../ai/CodexCli.js"
import { createMemoryPaths } from "./paths.js"
import { MemorizeStateStore } from "./state-store.js"
import { CodexMemorizeDistiller } from "./distiller.js"
import { LiveMemorizeTurnRunner } from "./live-runner.js"
import { memorizeRunNeeded } from "./timer.js"

export interface MemorizeServiceShape {
  readonly runIfNeeded: (now: Date) => Promise<{ ran: boolean; result: MemorizeRunResult | null }>
}

export class MemorizeService extends Context.Tag("MemorizeService")<
  MemorizeService,
  MemorizeServiceShape
>() {}

export const MemorizeServiceLive = Layer.effect(
  MemorizeService,
  Effect.gen(function* () {
    const config = yield* ConfigService
    const db = yield* Database
    const codex = yield* CodexCli

    const paths = createMemoryPaths({
      env: process.env,
    })
    const store = new MemorizeStateStore(paths)
    const distiller = new CodexMemorizeDistiller(codex)
    const runner = new LiveMemorizeTurnRunner({ db, paths, store, distiller })

    const env = config.isDev ? process.env : {}
    void env

    return {
      runIfNeeded: async (now: Date) => {
        const state = store.read()
        if (!memorizeRunNeeded(state.lastRunAt, now)) {
          return { ran: false, result: null }
        }

        const sinceCursor = state.lastProcessedThreadCursor
        const outcome = await runner.run({ sinceCursor, now })

        if (!outcome.ok) {
          return { ran: true, result: null }
        }

        return { ran: true, result: outcome.result }
      },
    }
  }),
)
