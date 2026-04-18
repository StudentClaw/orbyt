import { dirname } from "node:path"
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import type {
  PhonePushSettings,
  PushLinkedDevice,
  PushLinkedDevicePlatform,
  PushPairingSession,
  PushPairingStatusResult,
  UpdatePhonePushSettingsParams,
  WebPushSubscriptionRecord,
} from "@student-claw/contracts"
import webPush from "web-push"

type InternalLinkedDevice = PushLinkedDevice & {
  readonly subscription: WebPushSubscriptionRecord
}

type PushStoreData = {
  readonly vapidKeys: {
    readonly publicKey: string
    readonly privateKey: string
  }
  readonly settings: Omit<PhonePushSettings, "linkedDevice" | "activePairing">
  readonly linkedDevice: InternalLinkedDevice | null
  readonly activePairing: PushPairingSession | null
  readonly lastWeeklyInsightWeekKey: string | null
}

type PushStoreOptions = {
  readonly generateVapidKeys?: () => { publicKey: string; privateKey: string }
}

const DEFAULT_SETTINGS: Omit<PhonePushSettings, "linkedDevice" | "activePairing"> = {
  enabled: true,
  workflowEventsEnabled: true,
  weeklyInsightsEnabled: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  weeklyInsightsDay: 1,
  weeklyInsightsTime: "08:00",
  relayBaseUrl: "",
}

function normalizeSettings(
  current: Omit<PhonePushSettings, "linkedDevice" | "activePairing">,
  patch: UpdatePhonePushSettingsParams,
): Omit<PhonePushSettings, "linkedDevice" | "activePairing"> {
  return {
    enabled: patch.enabled ?? current.enabled,
    workflowEventsEnabled: patch.workflowEventsEnabled ?? current.workflowEventsEnabled,
    weeklyInsightsEnabled: patch.weeklyInsightsEnabled ?? current.weeklyInsightsEnabled,
    quietHoursStart: patch.quietHoursStart ?? current.quietHoursStart,
    quietHoursEnd: patch.quietHoursEnd ?? current.quietHoursEnd,
    weeklyInsightsDay: patch.weeklyInsightsDay ?? current.weeklyInsightsDay,
    weeklyInsightsTime: patch.weeklyInsightsTime ?? current.weeklyInsightsTime,
    relayBaseUrl: patch.relayBaseUrl ?? current.relayBaseUrl,
  }
}

function isTimeWithinQuietHours(time: string, quietStart: string, quietEnd: string): boolean {
  const toMinutes = (value: string): number => {
    const [hours = "0", minutes = "0"] = value.split(":")
    return Number(hours) * 60 + Number(minutes)
  }

  const target = toMinutes(time)
  const start = toMinutes(quietStart)
  const end = toMinutes(quietEnd)

  if (start === end) {
    return false
  }

  if (start < end) {
    return target >= start && target < end
  }

  return target >= start || target < end
}

export class PushStore {
  private data: PushStoreData

  constructor(
    private readonly filePath: string,
    options: PushStoreOptions = {},
  ) {
    this.data = this.load(options)
  }

  getVapidKeys(): { publicKey: string; privateKey: string } {
    return this.data.vapidKeys
  }

  getSettings(): PhonePushSettings {
    return {
      ...this.data.settings,
      linkedDevice: this.getLinkedDevice(),
      activePairing: this.data.activePairing,
    }
  }

  getPairingStatus(): PushPairingStatusResult {
    return {
      linkedDevice: this.getLinkedDevice(),
      activePairing: this.data.activePairing,
    }
  }

  getLinkedSubscription(): WebPushSubscriptionRecord | null {
    return this.data.linkedDevice?.subscription ?? null
  }

  getLastWeeklyInsightWeekKey(): string | null {
    return this.data.lastWeeklyInsightWeekKey
  }

  setLastWeeklyInsightWeekKey(weekKey: string | null): void {
    this.data = {
      ...this.data,
      lastWeeklyInsightWeekKey: weekKey,
    }
    this.persist()
  }

  updateSettings(patch: UpdatePhonePushSettingsParams): PhonePushSettings {
    const nextSettings = normalizeSettings(this.data.settings, patch)
    if (isTimeWithinQuietHours(nextSettings.weeklyInsightsTime, nextSettings.quietHoursStart, nextSettings.quietHoursEnd)) {
      throw new Error("Weekly insight time must be outside quiet hours.")
    }

    this.data = {
      ...this.data,
      settings: nextSettings,
    }
    this.persist()
    return this.getSettings()
  }

  setPairingSession(session: PushPairingSession | null): void {
    this.data = {
      ...this.data,
      activePairing: session,
    }
    this.persist()
  }

  updatePairingState(state: PushPairingSession["state"]): void {
    if (!this.data.activePairing) {
      return
    }

    this.data = {
      ...this.data,
      activePairing: {
        ...this.data.activePairing,
        state,
      },
    }
    this.persist()
  }

  linkDevice(input: {
    readonly platform: PushLinkedDevicePlatform
    readonly subscription: WebPushSubscriptionRecord
  }): PhonePushSettings {
    const linkedAt = new Date().toISOString()
    this.data = {
      ...this.data,
      linkedDevice: {
        endpoint: input.subscription.endpoint,
        platform: input.platform,
        linkedAt,
        subscription: input.subscription,
      },
      activePairing: this.data.activePairing
        ? {
            ...this.data.activePairing,
            state: "paired",
          }
        : null,
    }
    this.persist()
    return this.getSettings()
  }

  unlinkDevice(): PhonePushSettings {
    this.data = {
      ...this.data,
      linkedDevice: null,
    }
    this.persist()
    return this.getSettings()
  }

  private getLinkedDevice(): PushLinkedDevice | null {
    if (!this.data.linkedDevice) {
      return null
    }

    return {
      endpoint: this.data.linkedDevice.endpoint,
      platform: this.data.linkedDevice.platform,
      linkedAt: this.data.linkedDevice.linkedAt,
    }
  }

  private load(options: PushStoreOptions): PushStoreData {
    if (existsSync(this.filePath)) {
      return JSON.parse(readFileSync(this.filePath, "utf8")) as PushStoreData
    }

    const generateVapidKeys = options.generateVapidKeys ?? (() => webPush.generateVAPIDKeys())
    const data: PushStoreData = {
      vapidKeys: generateVapidKeys(),
      settings: DEFAULT_SETTINGS,
      linkedDevice: null,
      activePairing: null,
      lastWeeklyInsightWeekKey: null,
    }
    this.ensureDir()
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf8")
    return data
  }

  private persist(): void {
    this.ensureDir()
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf8")
  }

  private ensureDir(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
  }
}
