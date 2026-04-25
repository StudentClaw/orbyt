import { Layer } from "effect"
import { CronStoreLive } from "./store.js"
import { CronExecutorLive } from "./executor.js"
import { CronDeliveryLive } from "./delivery.js"
import { CronSchedulerLive } from "./scheduler.js"
import { CronAgentRunnerLive } from "./agent-runner.js"

const ExecutorWithDeps = CronExecutorLive.pipe(
  Layer.provideMerge(CronAgentRunnerLive),
  Layer.provideMerge(CronStoreLive),
)

export const CronServiceLive = Layer.mergeAll(
  CronStoreLive,
  CronAgentRunnerLive,
  ExecutorWithDeps,
  CronDeliveryLive,
  CronSchedulerLive.pipe(
    Layer.provideMerge(CronStoreLive),
    Layer.provideMerge(ExecutorWithDeps),
    Layer.provideMerge(CronDeliveryLive),
    // ProactiveMemory is provided externally via CoreLive; flagged here for clarity.
  ),
)

export { CronStore } from "./store.js"
export {
  CronExecutor,
  CronExecutorLive,
  MockCronExecutorLive,
  type ExecutionResult,
} from "./executor.js"
export { CronDelivery, CronDeliveryLive } from "./delivery.js"
export { CronScheduler, CronSchedulerLive } from "./scheduler.js"
export { CronAgentRunner, HEARTBEAT_THREAD_ID, DAILY_INSIGHT_THREAD_ID } from "./agent-runner.js"
export { seedDefaultJobs } from "./seed.js"
export { createReminderJob } from "./reminder-tool.js"
export {
  computeNextRunAt,
  computeNextCronRunAt,
  previewCronFireTimes,
  parseEveryMs,
  parseAtMs,
} from "./schedule-math.js"
