import { Schema } from "@effect/schema"

export const DesktopBootstrap = Schema.Struct({
  wsUrl: Schema.String,
  appVersion: Schema.String,
  platform: Schema.String,
})

export type DesktopBootstrap = Schema.Schema.Type<typeof DesktopBootstrap>
