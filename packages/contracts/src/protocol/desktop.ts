import { Schema } from "@effect/schema"

/**
 * Desktop-provided bootstrap data used to initialize the renderer runtime.
 */
export const DesktopBootstrap = Schema.Struct({
  wsUrl: Schema.String,
  wsAuthToken: Schema.String,
  appVersion: Schema.String,
  platform: Schema.String,
})

/**
 * Typed desktop bootstrap payload shared between Electron and the renderer.
 */
export type DesktopBootstrap = Schema.Schema.Type<typeof DesktopBootstrap>
