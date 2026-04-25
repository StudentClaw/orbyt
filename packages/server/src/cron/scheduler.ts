import { Context, Effect, Layer } from "effect"
import {
  CRON_CONCURRENCY,
  CRON_TICK_INTERVAL_MS,
  type CronJob,
} from "@orbyt/contracts"
import { CronStore } from "./store.js"
import { CronExecutor } from "./executor.js"
import { CronDelivery } from "./delivery.js"
import { ProactiveMemory } from "../proactive/index.js"
import { computeNextRunAt } from "./schedule-math.js"

export interface CronSchedulerShape {
  readonly start: () => () => void
  readonly tick: (now?: number) => Promise<void>
}

export class CronScheduler extends Context.Tag("CronScheduler")<
  CronScheduler,
  CronSchedulerShape
>() {}

function logError(scope: string, err: unknown): void {
  process.stderr.write(`Cron scheduler ${scope}: ${String(err)}\n`)
}

export const CronSchedulerLive = Layer.effect(
  CronScheduler,
  Effect.gen(function* () {
    const store = yield* CronStore
    const executor = yield* CronExecutor
    const delivery = yield* CronDelivery
    const memory = yield* ProactiveMemory

    let running = false
    let pending = false

    const runEntry = async (job: CronJob, runId: string): Promise<void> => {
      let result: Awaited<ReturnType<typeof executor.run>>
      try {
        result = await executor.run(job)
      } catch (err) {
        result = { status: "failed", error: String(err) }
      }

      const finishedAt = Date.now()
      const nextRunAt = computeNextRunAt(job, finishedAt)
      const deleteJob =
        job.scheduleKind === "at" && job.deleteAfterRun && result.status === "success"

      try {
        if (result.status === "success") {
          await delivery.deliverSuccess({ job, output: result.output })
        } else {
          await delivery.deliverFailure({ job, error: result.error })
        }
      } catch (err) {
        logError("delivery", err)
      }

      try {
        store.completeRun({
          runId,
          jobId: job.id,
          finishedAt,
          status: result.status,
          output: result.status === "success" ? result.output : null,
          error: result.status === "failed" ? result.error : null,
          nextRunAt,
          deleteJob,
        })
      } catch (err) {
        logError("completeRun", err)
      }
    }

    const tickOnce = async (now: number): Promise<void> => {
      store.maintenance(now)
      try {
        // Prune expired working-buffer notes alongside DB maintenance. Cheap.
        memory.pruneExpired(new Date(now))
      } catch (err) {
        logError("pruneWorkingBuffer", err)
      }
      const claimed = store.claimDue(now)
      if (claimed.length === 0) return

      const queue = [...claimed]
      const workerCount = Math.min(CRON_CONCURRENCY, queue.length)
      const worker = async (): Promise<void> => {
        for (;;) {
          const next = queue.shift()
          if (!next) return
          await runEntry(next.job, next.runId)
        }
      }
      const workers: Promise<void>[] = []
      for (let i = 0; i < workerCount; i += 1) {
        workers.push(worker())
      }
      await Promise.all(workers)
    }

    const tick: CronSchedulerShape["tick"] = async (now) => {
      const ts = now ?? Date.now()
      if (running) {
        pending = true
        return
      }
      running = true
      try {
        await tickOnce(ts)
      } catch (err) {
        logError("tickOnce", err)
      } finally {
        running = false
        if (pending) {
          pending = false
          setImmediate(() => {
            void tick()
          })
        }
      }
    }

    const start: CronSchedulerShape["start"] = () => {
      const handle = setInterval(() => {
        void tick()
      }, CRON_TICK_INTERVAL_MS)
      if (typeof handle === "object" && handle !== null && "unref" in handle) {
        ;(handle as { unref: () => void }).unref()
      }
      return () => {
        clearInterval(handle)
      }
    }

    return { start, tick }
  }),
)
