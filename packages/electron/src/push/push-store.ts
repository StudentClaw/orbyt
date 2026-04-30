import { dirname } from "node:path"
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import type {
  PhonePushSettings,
  UpdatePhonePushSettingsParams,
} from "@orbyt/contracts"

type PushStoreData = {
  readonly settings: PhonePushSettings
  readonly lastWeeklyInsightWeekKey: string | null
}

const DEFAULT_SETTINGS: PhonePushSettings = {
  enabled: true,
  weeklyInsightsEnabled: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  weeklyInsightsDay: 1,
  weeklyInsightsTime: "08:00",
}

function normalizeSettings(
  current: PhonePushSettings,
  patch: UpdatePhonePushSettingsParams,
): PhonePushSettings {
  return {
    enabled: patch.enabled ?? current.enabled,
    weeklyInsightsEnabled: patch.weeklyInsightsEnabled ?? current.weeklyInsightsEnabled,
    quietHoursStart: patch.quietHoursStart ?? current.quietHoursStart,
    quietHoursEnd: patch.quietHoursEnd ?? current.quietHoursEnd,
    weeklyInsightsDay: patch.weeklyInsightsDay ?? current.weeklyInsightsDay,
    weeklyInsightsTime: patch.weeklyInsightsTime ?? current.weeklyInsightsTime,
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

  constructor(private readonly filePath: string) {
    this.data = this.load()
  }

  getSettings(): PhonePushSettings {
    return this.data.settings
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
    if (
      isTimeWithinQuietHours(
        nextSettings.weeklyInsightsTime,
        nextSettings.quietHoursStart,
        nextSettings.quietHoursEnd,
      )
    ) {
      throw new Error("Weekly insight time must be outside quiet hours.")
    }

    this.data = {
      ...this.data,
      settings: nextSettings,
    }
    this.persist()
    return this.data.settings
  }

  private load(): PushStoreData {
    if (existsSync(this.filePath)) {
      return JSON.parse(readFileSync(this.filePath, "utf8")) as PushStoreData
    }

    const data: PushStoreData = {
      settings: DEFAULT_SETTINGS,
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
