import { Schema } from "@effect/schema"

export const PushLinkedDevicePlatform = Schema.Literal("ios", "android", "unknown")
export type PushLinkedDevicePlatform = Schema.Schema.Type<typeof PushLinkedDevicePlatform>

export const WebPushSubscriptionKeys = Schema.Struct({
  p256dh: Schema.String,
  auth: Schema.String,
})
export type WebPushSubscriptionKeys = Schema.Schema.Type<typeof WebPushSubscriptionKeys>

export const WebPushSubscriptionRecord = Schema.Struct({
  endpoint: Schema.String,
  expirationTime: Schema.NullOr(Schema.Number),
  keys: WebPushSubscriptionKeys,
})
export type WebPushSubscriptionRecord = Schema.Schema.Type<typeof WebPushSubscriptionRecord>

export const PushLinkedDevice = Schema.Struct({
  endpoint: Schema.String,
  platform: PushLinkedDevicePlatform,
  linkedAt: Schema.String,
})
export type PushLinkedDevice = Schema.Schema.Type<typeof PushLinkedDevice>

export const PushPairingState = Schema.Literal("pending", "paired", "expired", "cancelled")
export type PushPairingState = Schema.Schema.Type<typeof PushPairingState>

export const PushPairingSession = Schema.Struct({
  sessionId: Schema.String,
  qrUrl: Schema.String,
  expiresAt: Schema.String,
  state: PushPairingState,
})
export type PushPairingSession = Schema.Schema.Type<typeof PushPairingSession>

export const PhonePushSettings = Schema.Struct({
  enabled: Schema.Boolean,
  workflowEventsEnabled: Schema.Boolean,
  weeklyInsightsEnabled: Schema.Boolean,
  quietHoursStart: Schema.String,
  quietHoursEnd: Schema.String,
  weeklyInsightsDay: Schema.Number,
  weeklyInsightsTime: Schema.String,
  relayBaseUrl: Schema.String,
  linkedDevice: Schema.NullOr(PushLinkedDevice),
  activePairing: Schema.NullOr(PushPairingSession),
})
export type PhonePushSettings = Schema.Schema.Type<typeof PhonePushSettings>

export const UpdatePhonePushSettingsParams = Schema.Struct({
  enabled: Schema.optional(Schema.Boolean),
  workflowEventsEnabled: Schema.optional(Schema.Boolean),
  weeklyInsightsEnabled: Schema.optional(Schema.Boolean),
  quietHoursStart: Schema.optional(Schema.String),
  quietHoursEnd: Schema.optional(Schema.String),
  weeklyInsightsDay: Schema.optional(Schema.Number),
  weeklyInsightsTime: Schema.optional(Schema.String),
  relayBaseUrl: Schema.optional(Schema.String),
})
export type UpdatePhonePushSettingsParams = Schema.Schema.Type<typeof UpdatePhonePushSettingsParams>

export const PushPairingStatusResult = Schema.Struct({
  linkedDevice: Schema.NullOr(PushLinkedDevice),
  activePairing: Schema.NullOr(PushPairingSession),
})
export type PushPairingStatusResult = Schema.Schema.Type<typeof PushPairingStatusResult>

export const PushSendTestResult = Schema.Struct({
  ok: Schema.Boolean,
})
export type PushSendTestResult = Schema.Schema.Type<typeof PushSendTestResult>

export const PushPairingCompletion = Schema.Struct({
  platform: PushLinkedDevicePlatform,
  subscription: WebPushSubscriptionRecord,
})
export type PushPairingCompletion = Schema.Schema.Type<typeof PushPairingCompletion>
