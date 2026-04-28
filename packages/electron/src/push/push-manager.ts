import path from "node:path"
import { powerMonitor } from "electron"
import {
  RPC_METHODS,
  type DesktopBootstrap,
  type PhonePushSettings,
  type UpdatePhonePushSettingsParams,
  type WeeklyInsight,
} from "@orbyt/contracts"
import { PushDeliveryService } from "./push-delivery-service.js"
import { PushServerRpcClient } from "./push-server-rpc-client.js"
import { PushStore } from "./push-store.js"
import { WeeklyInsightScheduler } from "./weekly-insight-scheduler.js"

export interface PushManager {
  readonly start: () => Promise<void>
  readonly stop: () => void
  readonly getSettings: () => PhonePushSettings
  readonly updateSettings: (params: UpdatePhonePushSettingsParams) => PhonePushSettings
}

export function createPushManager(options: {
  readonly userDataPath: string
  readonly bootstrap: DesktopBootstrap
}): PushManager {
  const store = new PushStore(path.join(options.userDataPath, "push-notifications.json"))
  const delivery = new PushDeliveryService()
  const serverRpc = new PushServerRpcClient(options.bootstrap)
  const scheduler = new WeeklyInsightScheduler({
    store,
    fetchWeeklyInsight: () =>
      serverRpc.request<WeeklyInsight>(RPC_METHODS.ACTIVITY_GENERATE_WEEKLY_INSIGHT, {}),
    delivery,
  })

  const runCatchUp = (): void => {
    void scheduler.runCatchUpIfNeeded()
  }

  powerMonitor.on("resume", runCatchUp)

  return {
    start: async () => {
      scheduler.start()
      await scheduler.runCatchUpIfNeeded()
    },
    stop: () => {
      scheduler.stop()
      powerMonitor.removeListener("resume", runCatchUp)
    },
    getSettings: () => store.getSettings(),
    updateSettings: (params) => {
      const settings = store.updateSettings(params)
      scheduler.start()
      return settings
    },
  }
}
