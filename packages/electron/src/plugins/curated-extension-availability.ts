export type PluginAvailabilityContext = {
  platform: NodeJS.Platform
  systemVersion?: string
}

const APPLE_CALENDAR_PLUGIN_ID = "apple-calendar-mcp"
const MINIMUM_APPLE_CALENDAR_MACOS_MAJOR = 13
const MINIMUM_APPLE_CALENDAR_DARWIN_MAJOR = 22

function parseMacOsMajorVersion(systemVersion?: string): number | null {
  if (!systemVersion) {
    return null
  }

  const match = /^(\d+)(?:[.].*)?$/.exec(systemVersion.trim())
  if (!match) {
    return null
  }

  const major = Number.parseInt(match[1] ?? "", 10)
  return Number.isFinite(major) ? major : null
}

export function isCuratedExtensionVisibleOnHost(
  pluginId: string,
  context: PluginAvailabilityContext,
  platforms?: readonly NodeJS.Platform[],
): boolean {
  if (platforms && platforms.length > 0 && !platforms.includes(context.platform)) {
    return false
  }

  if (pluginId !== APPLE_CALENDAR_PLUGIN_ID) {
    return true
  }

  if (context.platform !== "darwin") {
    return false
  }

  const major = parseMacOsMajorVersion(context.systemVersion)
  if (major === null) {
    return true
  }

  // Electron and Node commonly expose Darwin kernel versions (for example 22.x on macOS 13).
  if (major >= 20) {
    return major >= MINIMUM_APPLE_CALENDAR_DARWIN_MAJOR
  }

  return major >= MINIMUM_APPLE_CALENDAR_MACOS_MAJOR
}
