import path from "node:path"
import { powerMonitor } from "electron"
import {
  RPC_METHODS,
  type DesktopBootstrap,
  type PhonePushSettings,
  type PushPairingSession,
  type PushPairingStatusResult,
  type PushSendTestResult,
  type UpdatePhonePushSettingsParams,
  type WeeklyInsight,
} from "@student-claw/contracts"
import { PushActivityBridge } from "./push-activity-bridge.js"
import { PushDeliveryService } from "./push-delivery-service.js"
import { PushPairingClient } from "./push-pairing-client.js"
import { PushServerRpcClient } from "./push-server-rpc-client.js"
import { PushStore } from "./push-store.js"
import { WeeklyInsightScheduler } from "./weekly-insight-scheduler.js"

export interface PushManager {
  readonly start: () => Promise<void>
  readonly stop: () => void
  readonly getSettings: () => PhonePushSettings
  readonly updateSettings: (params: UpdatePhonePushSettingsParams) => PhonePushSettings
  readonly startPairing: () => Promise<PushPairingSession>
  readonly getPairingStatus: () => Promise<PushPairingStatusResult>
  readonly cancelPairing: () => Promise<PhonePushSettings>
  readonly sendTest: () => Promise<PushSendTestResult>
  readonly unlinkDevice: () => PhonePushSettings
}

export function createPushManager(options: {
  readonly userDataPath: string
  readonly bootstrap: DesktopBootstrap
  readonly relayBaseUrl?: string
}): PushManager {
  const store = new PushStore(path.join(options.userDataPath, "push-notifications.json"))
  if (options.relayBaseUrl && !store.getSettings().relayBaseUrl) {
    store.updateSettings({ relayBaseUrl: options.relayBaseUrl })
  }

  const delivery = new PushDeliveryService(store)
  const pairingClient = new PushPairingClient()
  const serverRpc = new PushServerRpcClient(options.bootstrap)
  const activityBridge = new PushActivityBridge({
    wsUrl: options.bootstrap.wsUrl,
    wsAuthToken: options.bootstrap.wsAuthToken,
    store,
    delivery,
  })
  const scheduler = new WeeklyInsightScheduler({
    store,
    fetchWeeklyInsight: () => serverRpc.request<WeeklyInsight>(RPC_METHODS.ACTIVITY_GENERATE_WEEKLY_INSIGHT, {}),
    delivery,
  })

  const runCatchUp = () => {
    void scheduler.runCatchUpIfNeeded()
  }

  powerMonitor.on("resume", runCatchUp)

  return {
    start: async () => {
      activityBridge.start()
      scheduler.start()
      await scheduler.runCatchUpIfNeeded()
    },
    stop: () => {
      activityBridge.stop()
      scheduler.stop()
      powerMonitor.removeListener("resume", runCatchUp)
    },
    getSettings: () => store.getSettings(),
    updateSettings: (params) => {
      const settings = store.updateSettings(params)
      scheduler.start()
      return settings
    },
    startPairing: async () => {
      const settings = store.getSettings()
      if (!settings.relayBaseUrl) {
        throw new Error("Set a push relay base URL before pairing a phone.")
      }

      const session = await pairingClient.createSession(
        settings.relayBaseUrl,
        store.getVapidKeys().publicKey,
      )
      store.setPairingSession(session)
      return session
    },
    getPairingStatus: async () => {
      const settings = store.getSettings()
      if (!settings.activePairing) {
        return store.getPairingStatus()
      }

      if (new Date(settings.activePairing.expiresAt).getTime() <= Date.now()) {
        store.updatePairingState("expired")
        return store.getPairingStatus()
      }

      const status = await pairingClient.getSessionStatus(
        settings.relayBaseUrl,
        settings.activePairing.sessionId,
      )
      store.setPairingSession(status.session)

      if (status.completion) {
        store.linkDevice(status.completion)
        await delivery.sendTestPush()
        scheduler.start()
      }

      return store.getPairingStatus()
    },
    cancelPairing: async () => {
      const settings = store.getSettings()
      if (settings.activePairing) {
        await pairingClient.cancelSession(settings.relayBaseUrl, settings.activePairing.sessionId)
      }
      store.setPairingSession(null)
      return store.getSettings()
    },
    sendTest: async () => delivery.sendTestPush(),
    unlinkDevice: () => {
      const settings = store.unlinkDevice()
      scheduler.start()
      return settings
    },
  }
}
