import { Schema } from "@effect/schema"
import { FeatureFlags } from "./feature-flags.js"

/**
 * Desktop-provided bootstrap data used to initialize the renderer runtime.
 */
export const DesktopBootstrap = Schema.Struct({
  wsUrl: Schema.String,
  wsAuthToken: Schema.String,
  appVersion: Schema.String,
  platform: Schema.String,
  featureFlags: FeatureFlags,
})

/**
 * Typed desktop bootstrap payload shared between Electron and the renderer.
 */
export type DesktopBootstrap = Schema.Schema.Type<typeof DesktopBootstrap>
